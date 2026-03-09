from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .analytics.gold_silver_correlation import get_gold_silver_rolling_correlation
from .analytics.gold_silver_data import fetch_gold_silver_prices
from .analytics.gold_silver_prediction import get_gold_silver_prediction
from .models import Portfolio, PortfolioStock, Stock
from .serializers import (
    PortfolioListSerializer,
    PortfolioSerializer,
    StockSerializer,
    UserRegisterSerializer,
)
from .services import (
    SECTOR_SYMBOLS,
    get_bitcoin_forecast_analysis,
    get_assets_compare_analysis,
    get_bitcoin_prediction_analysis,
    get_company_forecast,
    get_bulk_stock_direction_forecasts,
    get_gold_silver_prediction_analysis,
    get_growth_analysis,
    get_ml_summary,
    get_symbols_for_sector,
    sync_stocks_from_yfinance,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.AllowAny]


class StockListCreateView(generics.ListCreateAPIView):
    queryset = Stock.objects.all().order_by("symbol")
    serializer_class = StockSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def list(self, request, *args, **kwargs):
        sector = request.query_params.get("sector")
        country = request.query_params.get("country")
        symbols_param = request.query_params.get("symbols")
        if symbols_param:
            symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
            sync_stocks_from_yfinance(symbols, sector_override=sector)
        else:
            symbols = get_symbols_for_sector(sector, country)
            sync_stocks_from_yfinance(symbols, sector_override=sector)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Stock.objects.all().order_by("symbol")
        sector = self.request.query_params.get("sector")
        country = self.request.query_params.get("country")
        symbols_param = self.request.query_params.get("symbols")
        if symbols_param:
            symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
            return queryset.filter(symbol__in=symbols).order_by("symbol")

        symbols = get_symbols_for_sector(sector, country)
        if not symbols:
            return queryset.none()
        return queryset.filter(symbol__in=symbols).order_by("symbol")


class SectorListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"sectors": list(SECTOR_SYMBOLS.keys())})


class StockForecastView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        symbols_param = request.query_params.get("symbols", "")
        symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
        if not symbols:
            return Response({"forecasts": {}})
        forecasts = get_bulk_stock_direction_forecasts(symbols)
        return Response({"forecasts": forecasts})


def _get_or_create_default_portfolio(user):
    portfolio = Portfolio.objects.filter(user=user).order_by("id").first()
    if portfolio:
        return portfolio
    return Portfolio.objects.create(user=user, name="My Portfolio")


def _get_requested_portfolio(request, source="query"):
    raw_portfolio_id = (
        request.query_params.get("portfolio_id")
        if source == "query"
        else request.data.get("portfolio_id")
    )
    queryset = Portfolio.objects.filter(user=request.user).order_by("id")

    if raw_portfolio_id in (None, ""):
        return _get_or_create_default_portfolio(request.user), None

    try:
        portfolio_id = int(raw_portfolio_id)
    except (TypeError, ValueError):
        return None, Response(
            {"detail": "portfolio_id must be an integer."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    portfolio = queryset.filter(id=portfolio_id).first()
    if not portfolio:
        return None, Response(
            {"detail": "Portfolio not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return portfolio, None


class PortfolioListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        portfolios = Portfolio.objects.filter(user=request.user).order_by("id")
        if not portfolios.exists():
            _get_or_create_default_portfolio(request.user)
            portfolios = Portfolio.objects.filter(user=request.user).order_by("id")
        serializer = PortfolioListSerializer(portfolios, many=True)
        return Response(serializer.data)

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response(
                {"detail": "Portfolio name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Portfolio.objects.filter(user=request.user, name__iexact=name).exists():
            return Response(
                {"detail": "A portfolio with this name already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        portfolio = Portfolio.objects.create(user=request.user, name=name)
        serializer = PortfolioListSerializer(portfolio)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PortfolioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        portfolio, error_response = _get_requested_portfolio(request, source="query")
        if error_response:
            return error_response
        symbols = list(
            portfolio.portfolio_stocks.select_related("stock").values_list(
                "stock__symbol", flat=True
            )
        )
        if symbols:
            sync_stocks_from_yfinance(symbols, force=True)
        serializer = PortfolioSerializer(portfolio)
        payload = serializer.data
        forecast_map = get_bulk_stock_direction_forecasts(symbols)
        for stock_row in payload.get("stocks", []):
            symbol = (stock_row.get("stock") or {}).get("symbol", "").upper()
            forecast = forecast_map.get(symbol, {})
            stock_row["future_trend"] = forecast.get("future_trend", "DOWN")
            stock_row["predicted_price"] = forecast.get("predicted_price")
            stock_row["trend_delta_percent"] = forecast.get("delta_percent")
        return Response(payload)


class PortfolioAddStockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        portfolio, error_response = _get_requested_portfolio(request, source="body")
        if error_response:
            return error_response

        stock_id = request.data.get("stock_id")
        quantity = request.data.get("quantity")
        buy_price = request.data.get("buy_price")

        if stock_id is None or quantity is None:
            return Response(
                {"detail": "stock_id and quantity are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            quantity = int(quantity)
            if quantity <= 0:
                raise ValueError
        except ValueError:
            return Response(
                {"detail": "quantity must be a positive integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stock = Stock.objects.get(id=stock_id)
        except Stock.DoesNotExist:
            return Response(
                {"detail": "Stock not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if buy_price is None:
            buy_price = stock.price
        try:
            buy_price = float(buy_price)
            if buy_price <= 0:
                raise ValueError
        except ValueError:
            return Response(
                {"detail": "buy_price must be a positive number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        portfolio_stock, created = PortfolioStock.objects.get_or_create(
            portfolio=portfolio,
            stock=stock,
            defaults={"quantity": quantity, "buy_price": buy_price},
        )

        if not created:
            total_qty = portfolio_stock.quantity + quantity
            weighted_buy_price = (
                (portfolio_stock.buy_price * portfolio_stock.quantity)
                + (buy_price * quantity)
            ) / total_qty
            portfolio_stock.quantity += quantity
            portfolio_stock.buy_price = weighted_buy_price
            portfolio_stock.save()

        symbols = list(
            portfolio.portfolio_stocks.select_related("stock").values_list(
                "stock__symbol", flat=True
            )
        )
        if symbols:
            sync_stocks_from_yfinance(symbols, force=True)

        serializer = PortfolioSerializer(portfolio)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PortfolioRemoveStockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        portfolio, error_response = _get_requested_portfolio(request, source="body")
        if error_response:
            return error_response

        stock_id = request.data.get("stock_id")
        if stock_id is None:
            return Response(
                {"detail": "stock_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count, _ = PortfolioStock.objects.filter(
            portfolio=portfolio, stock_id=stock_id
        ).delete()

        if deleted_count == 0:
            return Response(
                {"detail": "Stock not found in portfolio."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class PortfolioUpdateBuyPriceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        portfolio, error_response = _get_requested_portfolio(request, source="body")
        if error_response:
            return error_response

        stock_id = request.data.get("stock_id")
        buy_price = request.data.get("buy_price")

        if stock_id is None or buy_price is None:
            return Response(
                {"detail": "stock_id and buy_price are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            buy_price = float(buy_price)
            if buy_price <= 0:
                raise ValueError
        except ValueError:
            return Response(
                {"detail": "buy_price must be a positive number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        portfolio_stock = PortfolioStock.objects.filter(
            portfolio=portfolio, stock_id=stock_id
        ).first()
        if not portfolio_stock:
            return Response(
                {"detail": "Stock not found in portfolio."},
                status=status.HTTP_404_NOT_FOUND,
            )

        portfolio_stock.buy_price = buy_price
        portfolio_stock.save(update_fields=["buy_price"])

        serializer = PortfolioSerializer(portfolio)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PortfolioTotalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        portfolio, error_response = _get_requested_portfolio(request, source="query")
        if error_response:
            return error_response
        return Response({"total_value": portfolio.total_value()})


class GoldSilverAnalysisView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        result = get_gold_silver_prediction_analysis(period="2y")
        return Response(
            {
                "correlation": result["correlation"],
                "data": result["rows"],
                "predictions": result["predictions"],
                "count": len(result["rows"]),
            }
        )


class GoldSilverTrendView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        result = fetch_gold_silver_prices(period="3y", interval="1d")
        return Response(
            {
                "dates": result.dates,
                "gold_prices": result.gold_prices,
                "silver_prices": result.silver_prices,
            }
        )


class GoldSilverCorrelationView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(get_gold_silver_rolling_correlation(window=30, period="3y"))


class GoldSilverPredictionView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(get_gold_silver_prediction(days=7, period="2y"))


class BitcoinAnalysisView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        result = get_bitcoin_prediction_analysis(period="2y")
        return Response(
            {
                "data": result.get("rows", []),
                "prediction": result.get("prediction", {}),
                "count": len(result.get("rows", [])),
            }
        )


class CompareAnalysisView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        result = get_assets_compare_analysis(period="2y")
        return Response(result)


class GrowthAnalysisView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        symbols_param = request.query_params.get("symbols", "")
        symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
        if not symbols:
            return Response(
                {
                    "top_growth_sectors": [],
                    "sector_allocation": [],
                    "pca_points": [],
                    "forecast": {
                        "history_labels": [],
                        "history_values": [],
                        "forecast_labels": [],
                        "forecast_values": [],
                    },
                }
            )
        result = get_growth_analysis(symbols, forecast_days=7)
        return Response(result)


class MLSummaryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        symbols_param = request.query_params.get("symbols", "")
        symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
        result = get_ml_summary(symbols)
        return Response(result)


class MLCompanyForecastView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        symbol = (request.query_params.get("symbol") or "").strip().upper()
        if not symbol:
            return Response(
                {
                    "symbol": "",
                    "company_name": "",
                    "history_labels": [],
                    "history_values": [],
                    "forecast_labels": [],
                    "forecast_values": [],
                }
            )
        result = get_company_forecast(symbol=symbol, forecast_days=7)
        return Response(result)


class BitcoinForecastView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        result = get_bitcoin_forecast_analysis(period="6mo", forecast_days=7)
        return Response(result)

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Portfolio, PortfolioStock, Stock
from .serializers import PortfolioSerializer, StockSerializer, UserRegisterSerializer
from .services import SECTOR_SYMBOLS, get_symbols_for_sector, sync_stocks_from_yfinance


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
        symbols_param = request.query_params.get("symbols")
        if symbols_param:
            symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
            sync_stocks_from_yfinance(symbols, sector_override=sector)
        else:
            symbols = get_symbols_for_sector(sector)
            sync_stocks_from_yfinance(symbols, sector_override=sector)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Stock.objects.all().order_by("symbol")
        sector = self.request.query_params.get("sector")
        symbols_param = self.request.query_params.get("symbols")
        if symbols_param:
            symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
            return queryset.filter(symbol__in=symbols).order_by("symbol")

        symbols = get_symbols_for_sector(sector)
        if not symbols:
            return queryset.none()
        return queryset.filter(symbol__in=symbols).order_by("symbol")


class SectorListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"sectors": list(SECTOR_SYMBOLS.keys())})


class PortfolioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        portfolio, _ = Portfolio.objects.get_or_create(user=request.user)
        serializer = PortfolioSerializer(portfolio)
        return Response(serializer.data)


class PortfolioAddStockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
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

        portfolio, _ = Portfolio.objects.get_or_create(user=request.user)
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

        serializer = PortfolioSerializer(portfolio)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PortfolioRemoveStockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        stock_id = request.data.get("stock_id")
        if stock_id is None:
            return Response(
                {"detail": "stock_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        portfolio, _ = Portfolio.objects.get_or_create(user=request.user)
        deleted_count, _ = PortfolioStock.objects.filter(
            portfolio=portfolio, stock_id=stock_id
        ).delete()

        if deleted_count == 0:
            return Response(
                {"detail": "Stock not found in portfolio."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class PortfolioTotalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        portfolio, _ = Portfolio.objects.get_or_create(user=request.user)
        return Response({"total_value": portfolio.total_value()})

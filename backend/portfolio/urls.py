from django.urls import path
from .views import (
    BitcoinAnalysisView,
    BitcoinForecastView,
    CompareAnalysisView,
    GoldSilverAnalysisView,
    GoldSilverCorrelationView,
    GoldSilverPredictionView,
    GoldSilverTrendView,
    GrowthAnalysisView,
    MLCompanyForecastView,
    MLSummaryView,
    PortfolioAddStockView,
    PortfolioListCreateView,
    PortfolioRemoveStockView,
    PortfolioTotalView,
    PortfolioUpdateBuyPriceView,
    PortfolioView,
    RegisterView,
    SectorListView,
    StockForecastView,
    StockListCreateView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("sectors/", SectorListView.as_view(), name="sectors-list"),
    path("stocks/", StockListCreateView.as_view(), name="stocks-list-create"),
    path("stocks/forecast/", StockForecastView.as_view(), name="stocks-forecast"),
    path("portfolios/", PortfolioListCreateView.as_view(), name="portfolios-list-create"),
    path("portfolio/", PortfolioView.as_view(), name="portfolio-detail"),
    path("portfolio/add/", PortfolioAddStockView.as_view(), name="portfolio-add-stock"),
    path(
        "portfolio/remove/",
        PortfolioRemoveStockView.as_view(),
        name="portfolio-remove-stock",
    ),
    path(
        "portfolio/update-buy-price/",
        PortfolioUpdateBuyPriceView.as_view(),
        name="portfolio-update-buy-price",
    ),
    path("portfolio/total/", PortfolioTotalView.as_view(), name="portfolio-total"),
    path(
        "gold-silver/analysis/",
        GoldSilverAnalysisView.as_view(),
        name="gold-silver-analysis",
    ),
    path(
        "gold-silver-trend/",
        GoldSilverTrendView.as_view(),
        name="gold-silver-trend",
    ),
    path(
        "gold-silver-correlation/",
        GoldSilverCorrelationView.as_view(),
        name="gold-silver-correlation",
    ),
    path(
        "gold-silver-prediction/",
        GoldSilverPredictionView.as_view(),
        name="gold-silver-prediction",
    ),
    path(
        "bitcoin/analysis/",
        BitcoinAnalysisView.as_view(),
        name="bitcoin-analysis",
    ),
    path(
        "bitcoin/forecast/",
        BitcoinForecastView.as_view(),
        name="bitcoin-forecast",
    ),
    path(
        "compare/analysis/",
        CompareAnalysisView.as_view(),
        name="compare-analysis",
    ),
    path(
        "growth/analysis/",
        GrowthAnalysisView.as_view(),
        name="growth-analysis",
    ),
    path(
        "ml/summary/",
        MLSummaryView.as_view(),
        name="ml-summary",
    ),
    path(
        "ml/company-forecast/",
        MLCompanyForecastView.as_view(),
        name="ml-company-forecast",
    ),
]

from django.urls import path
from .views import (
    PortfolioAddStockView,
    PortfolioRemoveStockView,
    PortfolioTotalView,
    PortfolioView,
    RegisterView,
    SectorListView,
    StockListCreateView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("sectors/", SectorListView.as_view(), name="sectors-list"),
    path("stocks/", StockListCreateView.as_view(), name="stocks-list-create"),
    path("portfolio/", PortfolioView.as_view(), name="portfolio-detail"),
    path("portfolio/add/", PortfolioAddStockView.as_view(), name="portfolio-add-stock"),
    path(
        "portfolio/remove/",
        PortfolioRemoveStockView.as_view(),
        name="portfolio-remove-stock",
    ),
    path("portfolio/total/", PortfolioTotalView.as_view(), name="portfolio-total"),
]

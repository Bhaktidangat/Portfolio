from django.contrib import admin
from .models import Portfolio, PortfolioStock, Stock


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("id", "symbol", "company_name", "sector", "price", "pe_ratio")
    search_fields = ("symbol", "company_name", "sector")


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ("id", "user")


@admin.register(PortfolioStock)
class PortfolioStockAdmin(admin.ModelAdmin):
    list_display = ("id", "portfolio", "stock", "quantity", "buy_price")
    list_filter = ("stock",)

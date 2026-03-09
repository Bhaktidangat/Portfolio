from django.contrib.auth.models import User
from django.db import models
from django.db.models import F, Sum


class Stock(models.Model):
    symbol = models.CharField(max_length=20, unique=True)
    company_name = models.CharField(max_length=255)
    sector = models.CharField(max_length=255)
    price = models.FloatField()
    pe_ratio = models.FloatField(null=True, blank=True)
    min_price = models.FloatField(null=True, blank=True)
    max_price = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.symbol} - {self.company_name}"


class Portfolio(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="portfolios")
    name = models.CharField(max_length=120, default="My Portfolio")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"], name="unique_user_portfolio_name"
            )
        ]

    def __str__(self):
        return f"Portfolio({self.user.username}: {self.name})"

    def total_value(self):
        value = self.portfolio_stocks.aggregate(
            total=Sum(F("quantity") * F("stock__price"), output_field=models.FloatField())
        )["total"]
        return value or 0.0


class PortfolioStock(models.Model):
    portfolio = models.ForeignKey(
        Portfolio, on_delete=models.CASCADE, related_name="portfolio_stocks"
    )
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="portfolio_stocks")
    quantity = models.IntegerField()
    buy_price = models.FloatField(default=0.0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["portfolio", "stock"], name="unique_portfolio_stock"
            )
        ]

    def __str__(self):
        return f"{self.portfolio.user.username} - {self.stock.symbol} ({self.quantity})"

from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Portfolio, PortfolioStock, Stock


class StockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = ["id", "symbol", "company_name", "sector", "price", "pe_ratio"]


class PortfolioStockSerializer(serializers.ModelSerializer):
    stock = StockSerializer(read_only=True)
    stock_id = serializers.PrimaryKeyRelatedField(
        source="stock", queryset=Stock.objects.all(), write_only=True
    )
    current_price = serializers.SerializerMethodField()
    pe_ratio = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()
    profit_loss = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioStock
        fields = [
            "id",
            "stock",
            "stock_id",
            "quantity",
            "buy_price",
            "current_price",
            "pe_ratio",
            "discount",
            "profit_loss",
        ]

    def get_current_price(self, obj):
        return obj.stock.price

    def get_pe_ratio(self, obj):
        return obj.stock.pe_ratio

    def get_discount(self, obj):
        if obj.buy_price <= 0:
            return 0.0
        return ((obj.stock.price - obj.buy_price) / obj.buy_price) * 100

    def get_profit_loss(self, obj):
        return (obj.stock.price - obj.buy_price) * obj.quantity


class PortfolioSerializer(serializers.ModelSerializer):
    stocks = PortfolioStockSerializer(source="portfolio_stocks", many=True, read_only=True)
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ["id", "user", "stocks", "total_value"]
        read_only_fields = ["id", "user", "stocks", "total_value"]

    def get_total_value(self, obj):
        return obj.total_value()


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "password"]

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
        )

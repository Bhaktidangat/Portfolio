from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Iterable

import numpy as np
import yfinance as yf
from django.core.cache import cache
from sklearn.linear_model import LinearRegression

from .models import Stock

SECTOR_SYMBOLS = {
    "Technology": [
        "AAPL",
        "MSFT",
        "NVDA",
        "AVGO",
        "ORCL",
        "ADBE",
        "CRM",
        "CSCO",
        "IBM",
        "ACN",
    ],
    "Healthcare": [
        "JNJ",
        "PFE",
        "UNH",
        "MRK",
        "ABBV",
        "TMO",
        "DHR",
        "LLY",
        "BMY",
        "AMGN",
    ],
    "Banking": [
        "JPM",
        "BAC",
        "WFC",
        "C",
        "GS",
        "MS",
        "PNC",
        "USB",
        "SCHW",
        "BK",
    ],
    "Energy": [
        "XOM",
        "CVX",
        "COP",
        "SLB",
        "EOG",
        "MPC",
        "PSX",
        "VLO",
        "OXY",
        "KMI",
    ],
    "Consumer Goods": [
        "PG",
        "KO",
        "PEP",
        "PM",
        "MO",
        "CL",
        "KMB",
        "MDLZ",
        "GIS",
        "K",
    ],
    "Industrials": [
        "GE",
        "CAT",
        "HON",
        "BA",
        "UNP",
        "UPS",
        "LMT",
        "DE",
        "RTX",
        "MMM",
    ],
    "Telecommunications": [
        "VZ",
        "T",
        "TMUS",
        "CHTR",
        "CMCSA",
        "BCE",
        "TU",
        "VOD",
        "ORAN",
        "TEF",
    ],
    "Utilities": [
        "NEE",
        "DUK",
        "SO",
        "D",
        "AEP",
        "EXC",
        "SRE",
        "XEL",
        "PEG",
        "ED",
    ],
    "Real Estate": [
        "AMT",
        "PLD",
        "CCI",
        "EQIX",
        "O",
        "SPG",
        "PSA",
        "DLR",
        "WELL",
        "AVB",
    ],
}
DEFAULT_YFINANCE_SYMBOLS = [symbol for symbols in SECTOR_SYMBOLS.values() for symbol in symbols]

SYNC_TTL_SECONDS = 60


def get_symbols_for_sector(sector: str | None) -> list[str]:
    if not sector:
        return DEFAULT_YFINANCE_SYMBOLS
    return SECTOR_SYMBOLS.get(sector, [])


def _extract_price(ticker: yf.Ticker, info: dict) -> float | None:
    market_state = (info.get("marketState") or "").upper()

    # Prefer explicit pre/post market prices outside regular hours when available.
    if market_state.startswith("PRE"):
        pre_price = info.get("preMarketPrice")
        if pre_price is not None:
            return float(pre_price)
    if market_state.startswith("POST"):
        post_price = info.get("postMarketPrice")
        if post_price is not None:
            return float(post_price)

    fast_info = getattr(ticker, "fast_info", None)
    if fast_info:
        fast_price = fast_info.get("lastPrice") or fast_info.get("last_price")
        if fast_price is not None:
            return float(fast_price)

    # Prefer most recent intraday close for fresher price updates.
    intraday = ticker.history(period="5d", interval="1m")
    if not intraday.empty:
        return float(intraday["Close"].iloc[-1])

    price = info.get("currentPrice") or info.get("regularMarketPrice")
    if price is not None:
        return float(price)

    daily = ticker.history(period="1d")
    if not daily.empty:
        return float(daily["Close"].iloc[-1])

    return None


def _extract_min_max(ticker: yf.Ticker, info: dict) -> tuple[float | None, float | None]:
    fast_info = getattr(ticker, "fast_info", None) or {}

    day_low = (
        fast_info.get("dayLow")
        or fast_info.get("day_low")
        or info.get("dayLow")
        or info.get("regularMarketDayLow")
    )
    day_high = (
        fast_info.get("dayHigh")
        or fast_info.get("day_high")
        or info.get("dayHigh")
        or info.get("regularMarketDayHigh")
    )

    # Fallback to daily candle range if quote fields are missing.
    if day_low is None or day_high is None:
        daily = ticker.history(period="1d")
        if not daily.empty:
            if day_low is None and "Low" in daily.columns:
                day_low = float(daily["Low"].min())
            if day_high is None and "High" in daily.columns:
                day_high = float(daily["High"].max())

    min_price = float(day_low) if day_low is not None else None
    max_price = float(day_high) if day_high is not None else None
    return min_price, max_price


def _fetch_symbol_snapshot(symbol: str, sector_override: str | None = None) -> dict | None:
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        price = _extract_price(ticker, info)
        if price is None:
            return None

        company_name = (
            info.get("longName") or info.get("shortName") or info.get("displayName") or symbol
        )
        sector = sector_override or info.get("sector") or "Unknown"
        pe_ratio = info.get("trailingPE")
        min_price, max_price = _extract_min_max(ticker, info)

        return {
            "symbol": symbol,
            "company_name": company_name[:255],
            "sector": sector[:255],
            "price": float(price),
            "pe_ratio": float(pe_ratio) if pe_ratio is not None else None,
            "min_price": min_price,
            "max_price": max_price,
        }
    except Exception:
        return None


def sync_stocks_from_yfinance(
    symbols: Iterable[str], sector_override: str | None = None, force: bool = False
) -> list[Stock]:
    synced_stocks: list[Stock] = []
    normalized_symbols = [s.strip().upper() for s in symbols if s and s.strip()]
    symbols_to_fetch: list[str] = []

    for symbol in normalized_symbols:
        cache_key = f"yfinance:stock:{symbol}"
        if not force and cache.get(cache_key):
            existing = Stock.objects.filter(symbol=symbol).first()
            if existing:
                synced_stocks.append(existing)
            continue
        symbols_to_fetch.append(symbol)

    if symbols_to_fetch:
        max_workers = min(6, max(1, len(symbols_to_fetch)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            snapshots = list(
                executor.map(
                    lambda sym: _fetch_symbol_snapshot(sym, sector_override), symbols_to_fetch
                )
            )

        for snapshot in snapshots:
            if not snapshot:
                continue
            stock, _ = Stock.objects.update_or_create(
                symbol=snapshot["symbol"],
                defaults={
                    "company_name": snapshot["company_name"],
                    "sector": snapshot["sector"],
                    "price": snapshot["price"],
                    "pe_ratio": snapshot["pe_ratio"],
                    "min_price": snapshot["min_price"],
                    "max_price": snapshot["max_price"],
                },
            )
            synced_stocks.append(stock)
            cache.set(f"yfinance:stock:{snapshot['symbol']}", True, timeout=SYNC_TTL_SECONDS)

    return synced_stocks


def get_gold_silver_analysis(period: str = "5y") -> dict:
    """
    Fetch 5-year gold and silver close data, compute daily returns and correlation.
    """
    data = yf.download(
        tickers=["GC=F", "SI=F"],
        period=period,
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=True,
    )

    if data is None or data.empty:
        return {"correlation": 0.0, "rows": []}

    close = data["Close"].copy()
    if "GC=F" not in close.columns or "SI=F" not in close.columns:
        return {"correlation": 0.0, "rows": []}

    close = close[["GC=F", "SI=F"]].dropna()
    if close.empty:
        return {"correlation": 0.0, "rows": []}

    returns = close.pct_change()
    valid_returns = returns.dropna()
    correlation = (
        float(valid_returns["GC=F"].corr(valid_returns["SI=F"]))
        if not valid_returns.empty
        else 0.0
    )

    rows = []
    for idx in close.index:
        gold_close = float(close.at[idx, "GC=F"])
        silver_close = float(close.at[idx, "SI=F"])
        gold_ret = returns.at[idx, "GC=F"]
        silver_ret = returns.at[idx, "SI=F"]
        rows.append(
            {
                "date": idx.strftime("%Y-%m-%d"),
                "gold_close": round(gold_close, 4),
                "silver_close": round(silver_close, 4),
                "gold_returns": None if gold_ret != gold_ret else round(float(gold_ret), 8),
                "silver_returns": None
                if silver_ret != silver_ret
                else round(float(silver_ret), 8),
                "correlation_value": round(correlation, 6),
            }
        )

    return {"correlation": correlation, "rows": rows}


def get_stock_direction_forecast(symbol: str, period: str = "6mo") -> dict:
    """
    Predict next close and direction (UP/DOWN) based on recent close trend.
    """
    normalized_symbol = symbol.strip().upper()
    cache_key = f"yfinance:forecast:{normalized_symbol}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    result = {
        "symbol": normalized_symbol,
        "predicted_price": None,
        "future_trend": "DOWN",
        "delta_percent": None,
    }

    try:
        ticker = yf.Ticker(normalized_symbol)
        history = ticker.history(period=period, interval="1d")
        closes = history["Close"].dropna().tolist() if "Close" in history.columns else []
        if len(closes) < 3:
            cache.set(cache_key, result, timeout=SYNC_TTL_SECONDS)
            return result

        n = len(closes)
        x = list(range(n))
        x_mean = sum(x) / n
        y_mean = sum(closes) / n
        numerator = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, closes))
        denominator = sum((xi - x_mean) ** 2 for xi in x)
        slope = 0.0 if denominator == 0 else numerator / denominator
        intercept = y_mean - slope * x_mean

        current_price = float(closes[-1])
        predicted_price = float(intercept + slope * n)
        delta_percent = 0.0 if current_price == 0 else ((predicted_price - current_price) / current_price) * 100.0
        future_trend = "UP" if predicted_price >= current_price else "DOWN"

        result = {
            "symbol": normalized_symbol,
            "predicted_price": round(predicted_price, 4),
            "future_trend": future_trend,
            "delta_percent": round(delta_percent, 4),
        }
    except Exception:
        pass

    cache.set(cache_key, result, timeout=SYNC_TTL_SECONDS)
    return result


def get_bulk_stock_direction_forecasts(symbols: Iterable[str]) -> dict[str, dict]:
    unique_symbols = sorted({s.strip().upper() for s in symbols if s and s.strip()})
    if not unique_symbols:
        return {}

    max_workers = min(6, max(1, len(unique_symbols)))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(get_stock_direction_forecast, unique_symbols))

    return {item["symbol"]: item for item in results}


def _linear_regression_next_price(series: list[float]) -> float | None:
    if len(series) < 2:
        return None

    x = np.arange(len(series)).reshape(-1, 1)
    y = np.array(series, dtype=float)
    model = LinearRegression()
    model.fit(x, y)
    return float(model.predict(np.array([[len(series)]], dtype=float))[0])


def _arima_next_price(series: list[float]) -> float | None:
    if len(series) < 5:
        return None

    try:
        from statsmodels.tsa.arima.model import ARIMA
    except Exception:
        return None

    order = (5, 1, 0) if len(series) >= 30 else (2, 1, 0)
    try:
        model = ARIMA(series, order=order)
        fitted = model.fit()
        forecast = fitted.forecast(steps=1)
        return float(forecast[0])
    except Exception:
        return None


def _safe_expected_return(current_price: float, predicted_price: float | None) -> float | None:
    if predicted_price is None or current_price == 0:
        return None
    return float(((predicted_price - current_price) / current_price) * 100.0)


def _build_asset_prediction(asset_name: str, symbol: str, closes: list[float]) -> dict:
    if not closes:
        return {
            "asset": asset_name,
            "symbol": symbol,
            "current_price": None,
            "linear_regression_price": None,
            "arima_price": None,
            "expected_return_percent": None,
        }

    current_price = float(closes[-1])
    linear_pred = _linear_regression_next_price(closes)
    arima_pred = _arima_next_price(closes)
    valid_preds = [p for p in [linear_pred, arima_pred] if p is not None]
    combined_pred = float(sum(valid_preds) / len(valid_preds)) if valid_preds else None

    return {
        "asset": asset_name,
        "symbol": symbol,
        "current_price": round(current_price, 4),
        "linear_regression_price": None if linear_pred is None else round(float(linear_pred), 4),
        "arima_price": None if arima_pred is None else round(float(arima_pred), 4),
        "expected_return_percent": None
        if combined_pred is None
        else round(_safe_expected_return(current_price, combined_pred) or 0.0, 4),
    }


def get_gold_silver_prediction_analysis(period: str = "2y") -> dict:
    data = yf.download(
        tickers=["GC=F", "SI=F"],
        period=period,
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=True,
    )
    if data is None or data.empty:
        return {"rows": [], "predictions": {"gold": {}, "silver": {}}, "correlation": 0.0}

    close = data["Close"].copy()
    if "GC=F" not in close.columns or "SI=F" not in close.columns:
        return {"rows": [], "predictions": {"gold": {}, "silver": {}}, "correlation": 0.0}

    close = close[["GC=F", "SI=F"]].dropna()
    if close.empty:
        return {"rows": [], "predictions": {"gold": {}, "silver": {}}, "correlation": 0.0}

    returns = close.pct_change().dropna()
    correlation = float(returns["GC=F"].corr(returns["SI=F"])) if not returns.empty else 0.0

    rows = [
        {
            "date": idx.strftime("%Y-%m-%d"),
            "gold_close": round(float(close.at[idx, "GC=F"]), 4),
            "silver_close": round(float(close.at[idx, "SI=F"]), 4),
        }
        for idx in close.index
    ]

    gold_closes = close["GC=F"].astype(float).tolist()
    silver_closes = close["SI=F"].astype(float).tolist()

    return {
        "rows": rows,
        "correlation": round(correlation, 6),
        "predictions": {
            "gold": _build_asset_prediction("Gold", "GC=F", gold_closes),
            "silver": _build_asset_prediction("Silver", "SI=F", silver_closes),
        },
    }


def get_bitcoin_prediction_analysis(period: str = "2y") -> dict:
    ticker = yf.Ticker("BTC-USD")
    history = ticker.history(period=period, interval="1d")
    if history is None or history.empty or "Close" not in history.columns:
        return {"rows": [], "prediction": {}}

    close_series = history["Close"].dropna()
    rows = [
        {"date": idx.strftime("%Y-%m-%d"), "bitcoin_close": round(float(value), 4)}
        for idx, value in close_series.items()
    ]

    return {
        "rows": rows,
        "prediction": _build_asset_prediction(
            "Bitcoin",
            "BTC-USD",
            close_series.astype(float).tolist(),
        ),
    }


def get_assets_compare_analysis(period: str = "2y") -> dict:
    gold_silver = get_gold_silver_prediction_analysis(period=period)
    bitcoin = get_bitcoin_prediction_analysis(period=period)

    assets = [
        gold_silver.get("predictions", {}).get("gold", {}),
        gold_silver.get("predictions", {}).get("silver", {}),
        bitcoin.get("prediction", {}),
    ]
    filtered_assets = [asset for asset in assets if asset and asset.get("asset")]
    ranked = sorted(
        filtered_assets,
        key=lambda asset: asset.get("expected_return_percent")
        if asset.get("expected_return_percent") is not None
        else float("-inf"),
        reverse=True,
    )

    ranked_with_position = []
    for index, asset in enumerate(ranked, start=1):
        ranked_with_position.append({**asset, "rank": index})

    return {
        "assets": ranked_with_position,
        "best_asset": ranked_with_position[0] if ranked_with_position else None,
    }

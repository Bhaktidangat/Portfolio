from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Iterable

import numpy as np
import yfinance as yf
from django.core.cache import cache
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

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

COUNTRY_SECTOR_SYMBOLS = {
    "US": SECTOR_SYMBOLS,
    "IN": {
        "Technology": ["INFY.NS", "TCS.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS"],
        "Healthcare": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "APOLLOHOSP.NS"],
        "Banking": ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "AXISBANK.NS", "KOTAKBANK.NS"],
        "Energy": ["RELIANCE.NS", "ONGC.NS", "COALINDIA.NS", "BPCL.NS", "IOC.NS"],
        "Consumer Goods": ["ITC.NS", "HINDUNILVR.NS", "NESTLEIND.NS", "BRITANNIA.NS", "DABUR.NS"],
        "Industrials": ["LT.NS", "SIEMENS.NS", "BEL.NS", "HAL.NS", "ADANIPORTS.NS"],
        "Telecommunications": ["BHARTIARTL.NS", "INDUSTOWER.NS", "TATACOMM.NS", "MTNL.NS", "RAILTEL.NS"],
        "Utilities": ["NTPC.NS", "POWERGRID.NS", "TATAPOWER.NS", "ADANIPOWER.NS", "NHPC.NS"],
        "Real Estate": ["DLF.NS", "GODREJPROP.NS", "OBEROIRLTY.NS", "PRESTIGE.NS", "PHOENIXLTD.NS"],
    },
    "UK": {
        "Technology": ["SGE.L", "DARK.L", "SPT.L", "KWS.L", "CCC.L"],
        "Healthcare": ["AZN.L", "GSK.L", "HIK.L", "SN.L", "CTEC.L"],
        "Banking": ["HSBA.L", "BARC.L", "LLOY.L", "STAN.L", "NWG.L"],
        "Energy": ["SHEL.L", "BP.L", "ENOG.L", "HBR.L", "SEPL.L"],
        "Consumer Goods": ["ULVR.L", "DGE.L", "BATS.L", "IMB.L", "ABF.L"],
        "Industrials": ["RR.L", "BA.L", "SMIN.L", "WEIR.L", "MGGT.L"],
        "Telecommunications": ["VOD.L", "BT-A.L", "MONY.L", "FERG.L", "KGF.L"],
        "Utilities": ["NG.L", "SSE.L", "UU.L", "SVT.L", "PNN.L"],
        "Real Estate": ["LAND.L", "BLND.L", "BBOX.L", "PSN.L", "TW.L"],
    },
}
DEFAULT_YFINANCE_SYMBOLS = [symbol for symbols in SECTOR_SYMBOLS.values() for symbol in symbols]

SYNC_TTL_SECONDS = 60


def get_symbols_for_sector(sector: str | None, country: str | None = None) -> list[str]:
    country_code = (country or "").strip().upper()
    sector_map = COUNTRY_SECTOR_SYMBOLS.get(country_code) or SECTOR_SYMBOLS
    if not sector:
        return [symbol for symbols in sector_map.values() for symbol in symbols]
    return sector_map.get(sector, [])


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


def _normalize_symbols(symbols: Iterable[str] | None) -> list[str]:
    normalized = sorted({s.strip().upper() for s in (symbols or []) if s and s.strip()})
    return normalized


def _historical_closes_for_symbol(symbol: str, period: str = "6mo") -> list[tuple[str, float]]:
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period=period, interval="1d")
        if history is None or history.empty or "Close" not in history.columns:
            return []
        close_series = history["Close"].dropna()
        return [
            (idx.strftime("%Y-%m-%d"), float(value))
            for idx, value in close_series.items()
            if value == value
        ]
    except Exception:
        return []


def _linear_regression_forecast_series(series: list[float], forecast_days: int) -> list[float]:
    if not series or forecast_days <= 0:
        return []
    if len(series) < 2:
        return [float(series[-1])] * forecast_days

    x = np.arange(len(series)).reshape(-1, 1)
    y = np.array(series, dtype=float)
    model = LinearRegression()
    model.fit(x, y)
    future_x = np.arange(len(series), len(series) + forecast_days).reshape(-1, 1)
    predicted = model.predict(future_x)
    return [float(val) for val in predicted]


def _iterative_arima_forecast(series: list[float], forecast_days: int) -> list[float]:
    if not series or forecast_days <= 0:
        return []

    work_series = [float(v) for v in series]
    forecast: list[float] = []
    for _ in range(forecast_days):
        next_val = _arima_next_price(work_series)
        if next_val is None:
            next_val = _linear_regression_next_price(work_series) or work_series[-1]
        next_val = float(next_val)
        forecast.append(next_val)
        work_series.append(next_val)
    return forecast


def _build_date_labels(last_date: str | None, history_len: int, forecast_days: int) -> tuple[list[str], list[str]]:
    if not last_date:
        return ([str(i + 1) for i in range(history_len)], [f"F{i + 1}" for i in range(forecast_days)])

    try:
        start = np.datetime64(last_date)
        hist_labels = [
            str(start - np.timedelta64(history_len - 1 - i, "D"))
            for i in range(history_len)
        ]
        forecast_labels = [str(start + np.timedelta64(i + 1, "D")) for i in range(forecast_days)]
        return hist_labels, forecast_labels
    except Exception:
        return ([str(i + 1) for i in range(history_len)], [f"F{i + 1}" for i in range(forecast_days)])


def get_growth_analysis(symbols: Iterable[str], forecast_days: int = 7) -> dict:
    normalized_symbols = _normalize_symbols(symbols)
    if not normalized_symbols:
        return {
            "top_growth_sectors": [],
            "sector_allocation": [],
            "pca_points": [],
            "forecast": {"history_labels": [], "history_values": [], "forecast_labels": [], "forecast_values": []},
        }

    stocks = {stock.symbol: stock for stock in Stock.objects.filter(symbol__in=normalized_symbols)}
    history_by_symbol: dict[str, list[tuple[str, float]]] = {}
    for symbol in normalized_symbols:
        rows = _historical_closes_for_symbol(symbol, period="6mo")
        if rows:
            history_by_symbol[symbol] = rows

    sector_growth_map: dict[str, list[float]] = defaultdict(list)
    sector_allocation_map: dict[str, float] = defaultdict(float)
    pca_rows: list[dict] = []
    aggregate_history_map: dict[str, float] = defaultdict(float)

    for symbol, rows in history_by_symbol.items():
        prices = [price for _, price in rows]
        if len(prices) < 2:
            continue

        first_price = prices[0]
        last_price = prices[-1]
        growth_pct = ((last_price - first_price) / first_price) * 100.0 if first_price else 0.0
        returns = np.diff(prices) / np.maximum(np.array(prices[:-1]), 1e-6)
        volatility = float(np.std(returns)) * 100.0 if returns.size else 0.0
        stock_obj = stocks.get(symbol)
        sector = (stock_obj.sector if stock_obj else "Unknown") or "Unknown"
        company_name = (stock_obj.company_name if stock_obj else symbol) or symbol
        pe_ratio = float(stock_obj.pe_ratio) if stock_obj and stock_obj.pe_ratio is not None else 20.0

        sector_growth_map[sector].append(growth_pct)
        sector_allocation_map[sector] += max(last_price, 0.0)

        pca_rows.append(
            {
                "symbol": symbol,
                "company_name": company_name,
                "sector": sector,
                "features": [growth_pct, volatility, pe_ratio],
            }
        )

        for date_str, close in rows:
            aggregate_history_map[date_str] += close

    top_growth_sectors = sorted(
        [
            {"sector": sector, "growth_pct": round(float(np.mean(values)), 4)}
            for sector, values in sector_growth_map.items()
            if values
        ],
        key=lambda row: row["growth_pct"],
        reverse=True,
    )[:8]

    total_alloc = sum(sector_allocation_map.values()) or 1.0
    sector_allocation = sorted(
        [
            {
                "sector": sector,
                "value": round(value, 4),
                "allocation_pct": round((value / total_alloc) * 100.0, 2),
            }
            for sector, value in sector_allocation_map.items()
        ],
        key=lambda row: row["value"],
        reverse=True,
    )

    pca_points: list[dict] = []
    if pca_rows:
        feature_matrix = np.array([row["features"] for row in pca_rows], dtype=float)
        if len(pca_rows) >= 2:
            scaler = StandardScaler()
            scaled = scaler.fit_transform(feature_matrix)
            pca_model = PCA(n_components=2, random_state=42)
            transformed = pca_model.fit_transform(scaled)
            for row, coords in zip(pca_rows, transformed):
                pca_points.append(
                    {
                        "symbol": row["symbol"],
                        "company_name": row["company_name"],
                        "sector": row["sector"],
                        "x": round(float(coords[0]), 5),
                        "y": round(float(coords[1]), 5),
                    }
                )
        else:
            row = pca_rows[0]
            pca_points.append(
                {
                    "symbol": row["symbol"],
                    "company_name": row["company_name"],
                    "sector": row["sector"],
                    "x": 0.0,
                    "y": 0.0,
                }
            )

    sorted_dates = sorted(aggregate_history_map.keys())
    history_values = [float(aggregate_history_map[dt]) for dt in sorted_dates]
    forecast_values = _linear_regression_forecast_series(history_values, forecast_days)
    history_labels, forecast_labels = _build_date_labels(
        sorted_dates[-1] if sorted_dates else None,
        len(history_values),
        forecast_days,
    )

    return {
        "top_growth_sectors": top_growth_sectors,
        "sector_allocation": sector_allocation,
        "pca_points": pca_points,
        "forecast": {
            "history_labels": history_labels,
            "history_values": [round(v, 4) for v in history_values],
            "forecast_labels": forecast_labels,
            "forecast_values": [round(v, 4) for v in forecast_values],
        },
    }


def get_ml_summary(symbols: Iterable[str]) -> dict:
    normalized_symbols = _normalize_symbols(symbols)
    if not normalized_symbols:
        return {
            "cluster_groups": 0,
            "linear_regression_intercept": 0.0,
            "arima_predicted_value": 0.0,
            "companies": [],
        }

    stocks = {stock.symbol: stock for stock in Stock.objects.filter(symbol__in=normalized_symbols)}
    features: list[list[float]] = []
    companies: list[dict] = []
    aggregate_history_map: dict[str, float] = defaultdict(float)

    for symbol in normalized_symbols:
        rows = _historical_closes_for_symbol(symbol, period="6mo")
        if not rows:
            continue
        prices = [price for _, price in rows]
        if len(prices) < 3:
            continue
        ret = ((prices[-1] - prices[0]) / prices[0]) * 100.0 if prices[0] else 0.0
        returns = np.diff(prices) / np.maximum(np.array(prices[:-1]), 1e-6)
        vol = float(np.std(returns)) * 100.0 if returns.size else 0.0
        pe_ratio = (
            float(stocks[symbol].pe_ratio)
            if symbol in stocks and stocks[symbol].pe_ratio is not None
            else 20.0
        )
        features.append([ret, vol, pe_ratio])

        stock_obj = stocks.get(symbol)
        companies.append(
            {
                "symbol": symbol,
                "company_name": (stock_obj.company_name if stock_obj else symbol) or symbol,
            }
        )
        for date_str, close in rows:
            aggregate_history_map[date_str] += close

    cluster_groups = 0
    if features:
        feature_matrix = np.array(features, dtype=float)
        n_clusters = min(3, len(feature_matrix))
        if n_clusters >= 1:
            km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            km.fit(feature_matrix)
            cluster_groups = int(len(set(km.labels_.tolist())))

    sorted_dates = sorted(aggregate_history_map.keys())
    series = [float(aggregate_history_map[dt]) for dt in sorted_dates]
    intercept = 0.0
    if len(series) >= 2:
        x = np.arange(len(series)).reshape(-1, 1)
        y = np.array(series, dtype=float)
        lr = LinearRegression()
        lr.fit(x, y)
        intercept = float(lr.intercept_)

    arima_predicted_value = _arima_next_price(series)
    if arima_predicted_value is None:
        arima_predicted_value = _linear_regression_next_price(series) or (series[-1] if series else 0.0)

    return {
        "cluster_groups": cluster_groups,
        "linear_regression_intercept": round(intercept, 4),
        "arima_predicted_value": round(float(arima_predicted_value), 4),
        "companies": sorted(companies, key=lambda row: row["company_name"]),
    }


def get_company_forecast(symbol: str, forecast_days: int = 7) -> dict:
    normalized_symbol = (symbol or "").strip().upper()
    if not normalized_symbol:
        return {
            "symbol": "",
            "company_name": "",
            "history_labels": [],
            "history_values": [],
            "forecast_labels": [],
            "forecast_values": [],
        }

    rows = _historical_closes_for_symbol(normalized_symbol, period="6mo")
    if not rows:
        return {
            "symbol": normalized_symbol,
            "company_name": normalized_symbol,
            "history_labels": [],
            "history_values": [],
            "forecast_labels": [],
            "forecast_values": [],
        }

    history_labels = [date for date, _ in rows]
    history_values = [float(price) for _, price in rows]
    forecast_values = _linear_regression_forecast_series(history_values, forecast_days)
    _, forecast_labels = _build_date_labels(
        history_labels[-1] if history_labels else None,
        len(history_values),
        forecast_days,
    )
    stock_obj = Stock.objects.filter(symbol=normalized_symbol).first()
    company_name = (stock_obj.company_name if stock_obj else normalized_symbol) or normalized_symbol

    return {
        "symbol": normalized_symbol,
        "company_name": company_name,
        "history_labels": history_labels,
        "history_values": [round(v, 4) for v in history_values],
        "forecast_labels": forecast_labels,
        "forecast_values": [round(v, 4) for v in forecast_values],
    }


def get_bitcoin_forecast_analysis(period: str = "6mo", forecast_days: int = 7) -> dict:
    rows = _historical_closes_for_symbol("BTC-USD", period=period)
    if not rows:
        return {
            "historical": {"labels": [], "values": []},
            "forecast": {"labels": [], "values": []},
            "summary": {
                "trend": "neutral",
                "predicted_movement": "flat",
                "arima_latest_prediction": None,
                "insights": [],
                "explanation": "Insufficient BTC-USD historical data for forecasting.",
            },
        }

    hist_labels = [date for date, _ in rows]
    hist_values = [float(price) for _, price in rows]
    forecast_values = _iterative_arima_forecast(hist_values, forecast_days)
    _, forecast_labels = _build_date_labels(
        hist_labels[-1] if hist_labels else None,
        len(hist_values),
        forecast_days,
    )

    current = hist_values[-1]
    predicted = forecast_values[-1] if forecast_values else current
    pct = ((predicted - current) / current) * 100.0 if current else 0.0
    trend = "bullish" if pct > 1 else "bearish" if pct < -1 else "neutral"
    movement = "upward" if pct > 0.35 else "downward" if pct < -0.35 else "sideways"

    insights = [
        f"Current close: {current:.2f} USD",
        f"7-day forecast end: {predicted:.2f} USD",
        f"Expected move: {pct:.2f}%",
    ]
    explanation = (
        "ARIMA-based projection extends recent BTC-USD behavior. "
        "Forecast values should be treated as short-term probabilistic guidance, not certainty."
    )

    return {
        "historical": {"labels": hist_labels, "values": [round(v, 4) for v in hist_values]},
        "forecast": {"labels": forecast_labels, "values": [round(v, 4) for v in forecast_values]},
        "summary": {
            "trend": trend,
            "predicted_movement": movement,
            "arima_latest_prediction": round(predicted, 4),
            "insights": insights,
            "explanation": explanation,
        },
    }

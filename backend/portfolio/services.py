from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Iterable

import yfinance as yf
from django.core.cache import cache

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
    ],
}
DEFAULT_YFINANCE_SYMBOLS = [symbol for symbols in SECTOR_SYMBOLS.values() for symbol in symbols]

SYNC_TTL_SECONDS = 300


def get_symbols_for_sector(sector: str | None) -> list[str]:
    if not sector:
        return DEFAULT_YFINANCE_SYMBOLS
    return SECTOR_SYMBOLS.get(sector, [])


def _extract_price(ticker: yf.Ticker, info: dict) -> float | None:
    price = info.get("currentPrice") or info.get("regularMarketPrice")
    if price is not None:
        return float(price)

    fast_info = getattr(ticker, "fast_info", None)
    if fast_info:
        fast_price = fast_info.get("lastPrice") or fast_info.get("last_price")
        if fast_price is not None:
            return float(fast_price)

    history = ticker.history(period="1d")
    if not history.empty:
        return float(history["Close"].iloc[-1])

    return None


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

        return {
            "symbol": symbol,
            "company_name": company_name[:255],
            "sector": sector[:255],
            "price": float(price),
            "pe_ratio": float(pe_ratio) if pe_ratio is not None else None,
        }
    except Exception:
        return None


def sync_stocks_from_yfinance(
    symbols: Iterable[str], sector_override: str | None = None
) -> list[Stock]:
    synced_stocks: list[Stock] = []
    normalized_symbols = [s.strip().upper() for s in symbols if s and s.strip()]
    symbols_to_fetch: list[str] = []

    for symbol in normalized_symbols:
        cache_key = f"yfinance:stock:{symbol}"
        if cache.get(cache_key):
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
                },
            )
            synced_stocks.append(stock)
            cache.set(f"yfinance:stock:{snapshot['symbol']}", True, timeout=SYNC_TTL_SECONDS)

    return synced_stocks

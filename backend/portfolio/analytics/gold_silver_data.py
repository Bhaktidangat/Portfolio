from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
import yfinance as yf

GOLD_TICKER = "GC=F"
SILVER_TICKER = "SI=F"


@dataclass(frozen=True)
class GoldSilverFrame:
    dates: list[str]
    gold_prices: list[float]
    silver_prices: list[float]
    frame: pd.DataFrame


def _extract_close_frame(raw: pd.DataFrame) -> pd.DataFrame:
    if raw is None or raw.empty:
        return pd.DataFrame(columns=[GOLD_TICKER, SILVER_TICKER])

    # yfinance multi-ticker download returns a MultiIndex with OHLCV at the first level.
    if isinstance(raw.columns, pd.MultiIndex):
        if "Close" not in raw.columns.get_level_values(0):
            return pd.DataFrame(columns=[GOLD_TICKER, SILVER_TICKER])
        close = raw["Close"].copy()
    else:
        # Defensive fallback for unexpected shape.
        close = raw.copy()

    required = [GOLD_TICKER, SILVER_TICKER]
    if not all(symbol in close.columns for symbol in required):
        return pd.DataFrame(columns=required)

    close = close[required].dropna()
    close.index = pd.to_datetime(close.index)
    return close


def fetch_gold_silver_prices(period: str = "3y", interval: str = "1d") -> GoldSilverFrame:
    raw = yf.download(
        tickers=[GOLD_TICKER, SILVER_TICKER],
        period=period,
        interval=interval,
        auto_adjust=False,
        progress=False,
        threads=True,
    )
    close = _extract_close_frame(raw)

    if close.empty:
        return GoldSilverFrame(dates=[], gold_prices=[], silver_prices=[], frame=close)

    dates = [idx.strftime("%Y-%m-%d") for idx in close.index]
    gold_prices = close[GOLD_TICKER].astype(float).round(4).tolist()
    silver_prices = close[SILVER_TICKER].astype(float).round(4).tolist()

    return GoldSilverFrame(
        dates=dates,
        gold_prices=gold_prices,
        silver_prices=silver_prices,
        frame=close,
    )

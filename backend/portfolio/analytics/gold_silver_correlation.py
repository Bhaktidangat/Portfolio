from __future__ import annotations

from .gold_silver_data import GOLD_TICKER, SILVER_TICKER, fetch_gold_silver_prices


def get_gold_silver_rolling_correlation(window: int = 30, period: str = "3y") -> dict:
    data = fetch_gold_silver_prices(period=period, interval="1d")
    frame = data.frame
    if frame.empty:
        return {"dates": [], "correlation": []}

    returns = frame[[GOLD_TICKER, SILVER_TICKER]].pct_change().dropna()
    if returns.empty:
        return {"dates": [], "correlation": []}

    rolling = returns[GOLD_TICKER].rolling(window=window).corr(returns[SILVER_TICKER]).dropna()
    dates = [idx.strftime("%Y-%m-%d") for idx in rolling.index]
    correlation = [round(float(value), 6) for value in rolling.tolist()]
    return {"dates": dates, "correlation": correlation}

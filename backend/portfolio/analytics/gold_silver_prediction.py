from __future__ import annotations

from datetime import datetime
from datetime import timedelta

import numpy as np
from sklearn.linear_model import LinearRegression

from .gold_silver_data import GOLD_TICKER, SILVER_TICKER, fetch_gold_silver_prices


def _linear_regression_forecast(series: list[float], days: int = 7) -> list[float]:
    if len(series) < 2:
        return []
    x_train = np.arange(len(series), dtype=float).reshape(-1, 1)
    y_train = np.array(series, dtype=float)
    model = LinearRegression()
    model.fit(x_train, y_train)

    x_future = np.arange(len(series), len(series) + days, dtype=float).reshape(-1, 1)
    predictions = model.predict(x_future)
    return [round(float(value), 4) for value in predictions.tolist()]


def _arima_forecast(series: list[float], days: int = 7) -> list[float]:
    if len(series) < 10:
        return []
    try:
        from statsmodels.tsa.arima.model import ARIMA

        model = ARIMA(series, order=(5, 1, 0))
        fitted = model.fit()
        forecast = fitted.forecast(steps=days)
        return [round(float(value), 4) for value in forecast.tolist()]
    except Exception:
        return []


def _extend_dates(dates: list[str], days: int) -> list[str]:
    if not dates:
        return []
    last_date = datetime.strptime(dates[-1], "%Y-%m-%d").date()
    future = [(last_date + timedelta(days=offset)).strftime("%Y-%m-%d") for offset in range(1, days + 1)]
    return dates + future


def _with_future_padding(actual: list[float], days: int) -> list[float | None]:
    return [round(float(value), 4) for value in actual] + [None] * days


def _forecast_only_padding(
    forecast: list[float | None], history_len: int
) -> list[float | None]:
    return [None] * history_len + forecast


def get_gold_silver_prediction(days: int = 7, period: str = "2y") -> dict:
    data = fetch_gold_silver_prices(period=period, interval="1d")
    frame = data.frame
    if frame.empty:
        return {
            "dates": [],
            "gold_actual": [],
            "silver_actual": [],
            "gold_lr_prediction": [],
            "silver_lr_prediction": [],
            "gold_arima_prediction": [],
            "silver_arima_prediction": [],
        }

    gold_series = frame[GOLD_TICKER].astype(float).tolist()
    silver_series = frame[SILVER_TICKER].astype(float).tolist()

    gold_lr = _linear_regression_forecast(gold_series, days=days)
    silver_lr = _linear_regression_forecast(silver_series, days=days)
    gold_arima = _arima_forecast(gold_series, days=days)
    silver_arima = _arima_forecast(silver_series, days=days)

    # Guarantee consistent length with prediction horizon for chart alignment.
    gold_lr = (gold_lr + [None] * days)[:days]
    silver_lr = (silver_lr + [None] * days)[:days]
    gold_arima = (gold_arima + [None] * days)[:days]
    silver_arima = (silver_arima + [None] * days)[:days]

    all_dates = _extend_dates(data.dates, days)
    history_len = len(data.dates)

    return {
        "dates": all_dates,
        "gold_actual": _with_future_padding(gold_series, days),
        "silver_actual": _with_future_padding(silver_series, days),
        "gold_lr_prediction": _forecast_only_padding(gold_lr, history_len),
        "silver_lr_prediction": _forecast_only_padding(silver_lr, history_len),
        "gold_arima_prediction": _forecast_only_padding(gold_arima, history_len),
        "silver_arima_prediction": _forecast_only_padding(silver_arima, history_len),
    }

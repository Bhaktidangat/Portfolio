from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score

from portfolio.models import Portfolio, Stock

_LINEAR_MODEL: Optional[LinearRegression] = None
_LINEAR_FEATURE_COLUMNS = ["price", "quantity"]


def _get_stock_field_names() -> set[str]:
    return {field.name for field in Stock._meta.get_fields()}


def fetch_portfolio_stocks(portfolio_id: int) -> pd.DataFrame:
    portfolio_qs = Portfolio.objects.filter(id=portfolio_id)
    if not portfolio_qs.exists():
        print("Portfolio not found")
        return pd.DataFrame(
            columns=["id", "name", "symbol", "price", "quantity", "sector_id", "total_value"]
        )

    stock_fields = _get_stock_field_names()
    required_columns = ["id", "name", "symbol", "price", "quantity", "sector_id"]
    has_required_model_fields = {"name", "quantity", "portfolio"}.issubset(stock_fields)

    rows: List[Dict[str, Any]] = []
    if has_required_model_fields:
        stocks_qs = Stock.objects.filter(portfolio_id=portfolio_id).values(*required_columns)
        rows = list(stocks_qs)
    else:
        # Fallback for schemas where stock quantity lives on a through model.
        stocks_qs = (
            Stock.objects.filter(portfolio_stocks__portfolio_id=portfolio_id)
            .values("id", "company_name", "symbol", "price", "portfolio_stocks__quantity", "sector")
            .distinct()
        )
        for row in stocks_qs:
            rows.append(
                {
                    "id": row.get("id"),
                    "name": row.get("company_name"),
                    "symbol": row.get("symbol"),
                    "price": row.get("price"),
                    "quantity": row.get("portfolio_stocks__quantity"),
                    "sector_id": row.get("sector"),
                }
            )

    df = pd.DataFrame(rows, columns=required_columns)
    if df.empty:
        return pd.DataFrame(
            columns=["id", "name", "symbol", "price", "quantity", "sector_id", "total_value"]
        )

    df["price"] = pd.to_numeric(df["price"], errors="coerce").fillna(0.0)
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0.0)
    df["total_value"] = df["price"] * df["quantity"]

    csv_path = Path(__file__).resolve().parents[1] / f"portfolio_{portfolio_id}_stocks.csv"
    df.to_csv(csv_path, index=False)

    print(df.to_json(orient="records", indent=4))
    return df


def generate_value_matrix(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    if df.empty:
        return {"price": {}, "quantity": {}, "total_value": {}}

    matrix: Dict[str, Dict[str, float]] = {}
    for col in ["price", "quantity", "total_value"]:
        series = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        matrix[col] = {
            "sum": float(series.sum()),
            "mean": float(series.mean()),
            "max": float(series.max()),
            "min": float(series.min()),
        }
    return matrix


def build_analytical_table(df: pd.DataFrame) -> Dict[str, float]:
    if df.empty:
        return {
            "mean_price": 0.0,
            "max_price": 0.0,
            "min_price": 0.0,
            "total_portfolio_value": 0.0,
        }

    prices = pd.to_numeric(df["price"], errors="coerce").fillna(0.0)
    total_values = pd.to_numeric(df["total_value"], errors="coerce").fillna(0.0)
    return {
        "mean_price": float(prices.mean()),
        "max_price": float(prices.max()),
        "min_price": float(prices.min()),
        "total_portfolio_value": float(total_values.sum()),
    }


def calculate_portfolio_growth(df: pd.DataFrame) -> List[Dict[str, float]]:
    if df.empty:
        return []

    growth_df = df.copy()
    growth_df["total_value"] = pd.to_numeric(growth_df["total_value"], errors="coerce").fillna(0.0)
    growth_df["step"] = np.arange(1, len(growth_df) + 1)
    growth_df["cumulative_value"] = growth_df["total_value"].cumsum()

    initial = float(growth_df["cumulative_value"].iloc[0]) if len(growth_df) else 0.0
    if initial <= 0:
        growth_df["growth_pct"] = 0.0
    else:
        growth_df["growth_pct"] = ((growth_df["cumulative_value"] - initial) / initial) * 100.0

    return growth_df[["step", "total_value", "cumulative_value", "growth_pct"]].to_dict("records")


def run_kmeans_clustering(df: pd.DataFrame, n_clusters: int = 3) -> List[Dict[str, Any]]:
    if df.empty:
        return []

    work_df = df.copy()
    features = work_df[["price", "quantity", "total_value"]].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    cluster_count = min(n_clusters, len(features))
    if cluster_count < 1:
        return []

    model = KMeans(n_clusters=cluster_count, random_state=42, n_init=10)
    work_df["cluster_label"] = model.fit_predict(features)
    return work_df.to_dict("records")


def train_linear_regression(df: pd.DataFrame) -> Dict[str, Any]:
    global _LINEAR_MODEL

    if df.empty:
        _LINEAR_MODEL = None
        return {"coefficients": [], "intercept": 0.0, "prediction_graph": []}

    x = df[_LINEAR_FEATURE_COLUMNS].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    y = pd.to_numeric(df["total_value"], errors="coerce").fillna(0.0)

    model = LinearRegression()
    model.fit(x, y)
    _LINEAR_MODEL = model

    print(f"Linear Regression Coefficients: {model.coef_.tolist()}")
    print(f"Linear Regression Intercept: {float(model.intercept_)}")

    predicted = model.predict(x)
    prediction_graph = []
    for index, value in enumerate(predicted, start=1):
        prediction_graph.append(
            {
                "x": index,
                "actual_total_value": float(y.iloc[index - 1]),
                "predicted_total_value": float(value),
            }
        )

    return {
        "coefficients": [float(v) for v in model.coef_],
        "intercept": float(model.intercept_),
        "prediction_graph": prediction_graph,
    }


def train_logistic_regression(df: pd.DataFrame) -> Dict[str, float]:
    if df.empty:
        return {"accuracy": 0.0}

    work_df = df.copy()
    work_df["price"] = pd.to_numeric(work_df["price"], errors="coerce").fillna(0.0)
    work_df["quantity"] = pd.to_numeric(work_df["quantity"], errors="coerce").fillna(0.0)

    mean_price = work_df["price"].mean()
    y = (work_df["price"] > mean_price).astype(int)
    x = work_df[["price", "quantity"]]

    if y.nunique() < 2:
        accuracy = 1.0
        print(f"Logistic Regression Accuracy: {accuracy}")
        return {"accuracy": float(accuracy)}

    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(x, y)
    predictions = model.predict(x)
    accuracy = accuracy_score(y, predictions)
    print(f"Logistic Regression Accuracy: {accuracy}")
    return {"accuracy": float(accuracy)}


def predict_stock_value(price: float, quantity: float) -> float:
    if _LINEAR_MODEL is None:
        raise ValueError("Linear regression model is not trained. Call train_linear_regression first.")

    features = pd.DataFrame([[float(price), float(quantity)]], columns=_LINEAR_FEATURE_COLUMNS)
    prediction = _LINEAR_MODEL.predict(features)
    return float(prediction[0])


def generate_portfolio_analytics(portfolio_id: int) -> Dict[str, Any]:
    df = fetch_portfolio_stocks(portfolio_id)
    value_matrix = generate_value_matrix(df)
    analytical_table = build_analytical_table(df)
    portfolio_growth = calculate_portfolio_growth(df)
    clustering = run_kmeans_clustering(df)
    linear_regression = train_linear_regression(df)
    logistic_regression = train_logistic_regression(df)

    return {
        "portfolio_id": portfolio_id,
        "portfolio_growth": portfolio_growth,
        "value_matrix": value_matrix,
        "analytical_table": analytical_table,
        "prediction_graph": linear_regression["prediction_graph"],
        "kmeans_clustering": clustering,
        "linear_regression": {
            "coefficients": linear_regression["coefficients"],
            "intercept": linear_regression["intercept"],
        },
        "logistic_regression": logistic_regression,
    }

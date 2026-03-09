import json
import os
import sys
from pathlib import Path

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score

_LINEAR_MODEL = None


def _setup_django():
    """
    Ensure Django is configured when this module is run directly.
    In manage.py shell, Django is already configured and this is a no-op.
    """
    if "DJANGO_SETTINGS_MODULE" in os.environ:
        return

    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()


def fetch_portfolio_stocks(portfolio_id):
    """
    Fetch stocks for a portfolio, export CSV, print JSON,
    and run clustering/regression tasks.
    """
    _setup_django()

    from portfolio.models import Portfolio, PortfolioStock

    portfolio_qs = Portfolio.objects.filter(id=portfolio_id)
    if not portfolio_qs.exists():
        print("Portfolio not found")
        return pd.DataFrame()

    portfolio = portfolio_qs.first()

    stock_links = (
        PortfolioStock.objects.filter(portfolio=portfolio)
        .select_related("stock")
        .order_by("stock__symbol")
    )
    if not stock_links.exists():
        print("No stocks found for this portfolio")
        return pd.DataFrame()

    stock_ids = list(stock_links.values_list("stock_id", flat=True))
    print(f"Stock IDs in portfolio {portfolio_id}: {stock_ids}")

    rows = []
    for link in stock_links:
        if not link.stock_id:
            continue
        price = float(link.stock.price or 0.0)
        quantity = int(link.quantity or 0)
        rows.append(
            {
                "id": int(link.stock.id),
                "name": link.stock.company_name,
                "symbol": link.stock.symbol,
                "sector": link.stock.sector,
                "price": price,
                "quantity": quantity,
                "total_value": price * quantity,
            }
        )

    if not rows:
        print("No valid stock rows found for this portfolio")
        return pd.DataFrame()

    df = pd.DataFrame(
        rows, columns=["id", "name", "symbol", "sector", "price", "quantity", "total_value"]
    )
    df = df.fillna(0)

    csv_path = Path.cwd() / f"portfolio_{portfolio_id}_stocks.csv"
    df.to_csv(csv_path, index=False)

    print(f"Portfolio ID: {portfolio_id}")
    print(f"Total stocks processed: {len(df)}")
    print(f"Stock IDs: {df['id'].tolist()}")
    print("Stock JSON:")
    print(df.to_json(orient="records", indent=4))

    clustered_df = run_clustering(df)
    linear_model = run_linear_regression(clustered_df)
    run_logistic_regression(clustered_df)

    if linear_model is not None and not clustered_df.empty:
        sample_row = clustered_df.iloc[0]
        print("Sample prediction output:")
        predict_stock_value(sample_row["price"], sample_row["quantity"])

    return clustered_df


def run_clustering(df):
    """
    Apply KMeans clustering using price and quantity.
    """
    if df.empty:
        print("Clustering skipped: empty DataFrame")
        return df

    work_df = df.copy()
    features = work_df[["price", "quantity"]].apply(pd.to_numeric, errors="coerce").fillna(0)

    # Use up to 3 clusters; fallback when sample size is smaller.
    n_clusters = 3 if len(features) >= 3 else max(1, len(features))
    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    work_df["cluster_label"] = model.fit_predict(features)
    print("Cluster labels by stock:")
    print(work_df[["id", "symbol", "sector", "cluster_label"]].to_json(orient="records", indent=4))
    return work_df


def run_linear_regression(df):
    """
    Train linear regression to predict total_value from price and quantity.
    """
    global _LINEAR_MODEL

    if df.empty:
        print("Linear regression skipped: empty DataFrame")
        return None

    work_df = df.copy()
    x = work_df[["price", "quantity"]].apply(pd.to_numeric, errors="coerce").fillna(0)
    y = pd.to_numeric(work_df["total_value"], errors="coerce").fillna(0)

    model = LinearRegression()
    model.fit(x, y)
    predictions = model.predict(x)
    work_df["predicted_total_value"] = predictions

    _LINEAR_MODEL = model

    print(f"LinearRegression coefficients: {model.coef_.tolist()}")
    print(f"LinearRegression intercept: {float(model.intercept_)}")
    print("Predicted vs actual total_value per stock:")
    print(
        work_df[
            [
                "id",
                "symbol",
                "sector",
                "price",
                "quantity",
                "total_value",
                "predicted_total_value",
            ]
        ]
        .to_json(orient="records", indent=4)
    )

    return model


def run_logistic_regression(df):
    """
    Train logistic regression with binary target:
    1 if price > mean(price), else 0.
    """
    if df.empty:
        print("Logistic regression skipped: empty DataFrame")
        return None

    work_df = df.copy()
    work_df["price"] = pd.to_numeric(work_df["price"], errors="coerce").fillna(0)
    work_df["quantity"] = pd.to_numeric(work_df["quantity"], errors="coerce").fillna(0)

    mean_price = work_df["price"].mean()
    work_df["target"] = (work_df["price"] > mean_price).astype(int)

    # Logistic regression requires at least two classes.
    if work_df["target"].nunique() < 2:
        print("LogisticRegression skipped: target has only one class")
        return None

    x = work_df[["price", "quantity"]]
    y = work_df["target"]

    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(x, y)
    pred = model.predict(x)
    accuracy = accuracy_score(y, pred)
    print(f"LogisticRegression accuracy: {accuracy:.4f}")
    return model


def predict_stock_value(price, quantity):
    """
    Predict total value using the trained linear regression model.
    """
    if _LINEAR_MODEL is None:
        print("Linear model not trained yet. Run fetch_portfolio_stocks(portfolio_id) first.")
        return None

    feature_df = pd.DataFrame([{"price": float(price), "quantity": float(quantity)}])
    predicted_value = float(_LINEAR_MODEL.predict(feature_df)[0])
    print(f"Predicted total_value: {predicted_value:.4f}")
    return predicted_value


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Portfolio clustering and regression utility")
    parser.add_argument("portfolio_id", type=int, help="Portfolio ID")
    parser.add_argument("--predict-price", type=float, default=None, help="Price for prediction")
    parser.add_argument("--predict-quantity", type=float, default=None, help="Quantity for prediction")
    args = parser.parse_args()

    fetch_portfolio_stocks(args.portfolio_id)
    if args.predict_price is not None and args.predict_quantity is not None:
        predict_stock_value(args.predict_price, args.predict_quantity)

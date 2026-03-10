# Stock Market Analysis & Prediction System

## Project Overview

This project is a Stock Market Analysis and Prediction System. It helps users analyze stock market trends, sector growth, and short-term forecasts using simple ML methods. The system uses historical market data and visual charts to show insights.

---

## Features Implemented

### 1. Dashboard

- Portfolio builder with sector and country filters
- Live stock snapshots pulled from Yahoo Finance via `yfinance`
- Portfolio metrics like total value, profit/loss, discount percentage, and P/E ratio
- Charts for profit/loss, discount percentage, opportunity value, and P/E ratio

---

### 2. Growth Analysis

On the Growth page we implemented:

- Top Growth Sectors graph
- Sector-wise allocation chart
- PCA Scatter Plot to visualize clustering of portfolio stocks
- 7-day forecast graph using Linear Regression based on historical portfolio values

---

### 3. Machine Learning Analysis

The ML Analysis page shows summary cards instead of charts. These cards show:

- Number of clusters detected
- Linear Regression intercept for the aggregate series
- ARIMA one-step predicted value

It also includes a per-company 7-day forecast chart.

---

### 4. Gold & Silver Analysis

This page analyzes the relationship between Gold and Silver prices.

- Gold vs Silver trend graph (3 years of data)
- Gold-Silver rolling correlation graph (30-day window)
- Gold and Silver price prediction for next 7 days using Linear Regression and ARIMA

---

### 5. Bitcoin Analysis

- BTC-USD historical trend
- 7-day ARIMA forecast
- Plain-language summary of the short-term outlook

---

### 6. Compare Stocks

- Simple stock comparison view using mock data

---

## Technologies Used

Frontend:

- React
- Vite
- React Router
- Axios
- Chart.js
- react-chartjs-2

Backend:

- Python
- Django
- Django REST Framework
- SimpleJWT

Data & ML:

- pandas
- NumPy
- scikit-learn
- statsmodels
- yfinance

Tools:

- Git
- VS Code

---

## How to Run the Project

Open two terminals: one for backend, one for frontend.

---

### Step 1. Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
```

On macOS or Linux, activate with `source .venv/bin/activate`.

---

### Step 2. Start the backend API

```bash
cd backend
.venv\Scripts\activate
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000`.

---

### Step 3. Frontend setup

```bash
cd stock-frontend
npm install
```

---

### Step 4. Start the frontend app

```bash
cd stock-frontend
npm run dev
```

The UI runs at `http://localhost:5173`.

---

## Machine Learning Models Used

- Linear Regression
- PCA (Principal Component Analysis)
- KMeans clustering
- ARIMA (time-series forecasting)

---

## Project Structure

```
project/
+-- backend/
¦   +-- config/
¦   +-- portfolio/
¦   +-- manage.py
+-- stock-frontend/
¦   +-- src/
¦   +-- index.html
¦   +-- package.json
+-- README.md
```

---

## Notes

- The login screen is a frontend-only toggle using local storage. The backend provides JWT endpoints, but the current UI does not call them.
- Some screens (like Compare) use mock data for demo purposes.
- Live data depends on outbound network access for `yfinance`.

---

## Environment Variables (Optional)

The backend uses SQLite by default. To use Postgres, set:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`

Other optional variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`

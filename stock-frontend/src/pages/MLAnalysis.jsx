import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChartCard from "../components/ChartCard";
import SearchableSelect from "../components/SearchableSelect";
import { registerCharts } from "../charts/registerCharts";
import { forecastAreaPlugin, getForecastChartOptions } from "../charts/forecastTheme";
import api from "../api/axios";
import { dashboardSeedPortfolio } from "../data/mockData";

registerCharts();
const PORTFOLIO_STORAGE_KEY = "dashboard_portfolio_rows";

function getPortfolioSymbols() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : dashboardSeedPortfolio;
    const rows = Array.isArray(parsed) ? parsed : dashboardSeedPortfolio;
    return Array.from(
      new Set(
        rows
          .map((row) => String(row?.symbol || "").trim().toUpperCase())
          .filter(Boolean)
      )
    );
  } catch {
    return Array.from(
      new Set(dashboardSeedPortfolio.map((row) => String(row.symbol || "").trim().toUpperCase()))
    );
  }
}

export default function MLAnalysis() {
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [summary, setSummary] = useState({
    cluster_groups: 0,
    linear_regression_intercept: 0,
    arima_predicted_value: 0,
    companies: [],
  });
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [forecast, setForecast] = useState({
    history_labels: [],
    history_values: [],
    forecast_labels: [],
    forecast_values: [],
    company_name: "",
  });

  useEffect(() => {
    const run = async () => {
      let symbols = [];
try {
  const portfolioRes = await api.get("/portfolio/");
  const stocks = portfolioRes.data?.stocks || [];
  symbols = stocks.map((item) => String(item.stock?.symbol || "").trim().toUpperCase()).filter(Boolean);
} catch { setSummaryLoading(false); return; }
if (!symbols.length) { setSummaryLoading(false); return; }
      setSummaryLoading(true);
      try {
        const response = await api.get("/ml/summary/", {
          params: { symbols: symbols.join(",") },
        });
        const payload = response.data || {};
        setSummary({
          cluster_groups: Number(payload.cluster_groups || 0),
          linear_regression_intercept: Number(payload.linear_regression_intercept || 0),
          arima_predicted_value: Number(payload.arima_predicted_value || 0),
          companies: Array.isArray(payload.companies) ? payload.companies : [],
        });
        setSummaryError("");
      } catch {
        setSummaryError("Unable to load ML summary.");
      } finally {
        setSummaryLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!summary.companies.length) {
      setSelectedSymbol("");
      return;
    }
    if (!summary.companies.some((row) => row.symbol === selectedSymbol)) {
      setSelectedSymbol(summary.companies[0].symbol);
    }
  }, [summary.companies, selectedSymbol]);

  useEffect(() => {
    const run = async () => {
      if (!selectedSymbol) return;
      setForecastLoading(true);
      try {
        const response = await api.get("/ml/company-forecast/", {
          params: { symbol: selectedSymbol },
        });
        const payload = response.data || {};
        setForecast({
          history_labels: Array.isArray(payload.history_labels) ? payload.history_labels : [],
          history_values: Array.isArray(payload.history_values) ? payload.history_values : [],
          forecast_labels: Array.isArray(payload.forecast_labels) ? payload.forecast_labels : [],
          forecast_values: Array.isArray(payload.forecast_values) ? payload.forecast_values : [],
          company_name: payload.company_name || selectedSymbol,
        });
        setForecastError("");
      } catch {
        setForecastError("Unable to load company forecast.");
      } finally {
        setForecastLoading(false);
      }
    };
    run();
  }, [selectedSymbol]);

  const companyOptions = useMemo(
    () =>
      summary.companies.map((row) => ({
        value: row.symbol,
        label: `${row.symbol} - ${row.company_name}`,
      })),
    [summary.companies]
  );

  const chartLabels = [...forecast.history_labels, ...forecast.forecast_labels];
  const historySeries = [...forecast.history_values, ...new Array(forecast.forecast_values.length).fill(null)];
  const predictionSeries = [
    ...new Array(Math.max(forecast.history_values.length - 1, 0)).fill(null),
    forecast.history_values.at(-1) ?? null,
    ...forecast.forecast_values,
  ];

  const metrics = [
    {
      title: "Cluster Groups",
      value: String(summary.cluster_groups),
      description: "Total distinct groups identified from portfolio stock feature clustering.",
    },
    {
      title: "Linear Regression Intercept",
      value: summary.linear_regression_intercept.toFixed(4),
      description: "Baseline value from the trained linear regression model for aggregate portfolio series.",
    },
    {
      title: "ARIMA Predicted Value",
      value: summary.arima_predicted_value.toFixed(4),
      description: "Latest ARIMA-based one-step forecast value from the portfolio aggregate signal.",
    },
  ];

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <h2 className="page-title">Machine Learning Analysis</h2>
          {summaryError ? <p className="loss-text">{summaryError}</p> : null}
          {summaryLoading ? <p className="muted-text">Loading ML summary...</p> : null}

          <div className="stats-grid">
            {metrics.map((metric) => (
              <div className="stat-card" key={metric.title}>
                <p>{metric.title}</p>
                <strong>{metric.value}</strong>
                <small className="muted-text">{metric.description}</small>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Future Prediction Graph</h3>
            <SearchableSelect
              label="Company"
              value={selectedSymbol}
              options={companyOptions}
              onChange={setSelectedSymbol}
              disabled={!companyOptions.length || forecastLoading}
            />
            {forecastError ? <p className="loss-text">{forecastError}</p> : null}
            {forecastLoading ? <p className="muted-text">Loading forecast...</p> : null}
            <ChartCard
              title={selectedSymbol ? `${forecast.company_name || selectedSymbol} - 7 Day Forecast` : "Forecast"}
              className="forecast-card"
              kicker="Future Prediction Graph"
            >
              <Line
                plugins={[forecastAreaPlugin]}
                data={{
                  labels: chartLabels,
                  datasets: [
                    {
                      label: "Historical",
                      data: historySeries,
                      borderColor: "#38bdf8",
                      backgroundColor: "rgba(56, 189, 248, 0.24)",
                      pointBackgroundColor: "#7dd3fc",
                      pointBorderColor: "#0b203e",
                      fill: true,
                      tension: 0.3,
                    },
                    {
                      label: "Predicted Next 7 Days",
                      data: predictionSeries,
                      borderColor: "#a78bfa",
                      pointBackgroundColor: "#c4b5fd",
                      pointBorderColor: "#0b203e",
                      borderDash: [4, 6],
                      fill: false,
                      tension: 0.3,
                      spanGaps: true,
                    },
                  ],
                }}
                options={getForecastChartOptions({ maxTicksLimit: 14 })}
              />
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  );
}

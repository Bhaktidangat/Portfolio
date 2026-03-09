import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChartCard from "../components/ChartCard";
import StatCard from "../components/StatCard";
import { registerCharts } from "../charts/registerCharts";
import { forecastAreaPlugin, getForecastChartOptions } from "../charts/forecastTheme";
import api from "../api/axios";

registerCharts();

export default function Bitcoin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    historical: { labels: [], values: [] },
    forecast: { labels: [], values: [] },
    summary: {
      trend: "neutral",
      predicted_movement: "sideways",
      arima_latest_prediction: null,
      insights: [],
      explanation: "",
    },
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const response = await api.get("/bitcoin/forecast/");
        setData(response.data || data);
        setError("");
      } catch {
        setError("Unable to load BTC-USD forecast.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const historicalValues = data.historical?.values || [];
  const forecastValues = data.forecast?.values || [];
  const labels = [...(data.historical?.labels || []), ...(data.forecast?.labels || [])];
  const historicalSeries = [...historicalValues, ...new Array(forecastValues.length).fill(null)];
  const forecastSeries = [
    ...new Array(Math.max(historicalValues.length - 1, 0)).fill(null),
    historicalValues.at(-1) ?? null,
    ...forecastValues,
  ];

  const currentPrice = historicalValues.at(-1) || 0;
  const avg = historicalValues.length
    ? historicalValues.reduce((sum, value) => sum + value, 0) / historicalValues.length
    : 0;
  const trend = String(data.summary?.trend || "neutral").toUpperCase();
  const movement = data.summary?.predicted_movement || "sideways";

  const trendColor = useMemo(() => {
    if (trend === "BULLISH") return "profit-text";
    if (trend === "BEARISH") return "loss-text";
    return "muted-text";
  }, [trend]);

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <h2 className="page-title">Bitcoin Analysis</h2>
          {error ? <p className="loss-text">{error}</p> : null}
          {loading ? <p className="muted-text">Loading BTC-USD analytics...</p> : null}

          <div className="stats-grid">
            <StatCard label="Current BTC Trend" value={trend} />
            <StatCard label="Current Price" value={currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
            <StatCard label="Average Price (6M)" value={avg.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
            <StatCard
              label="ARIMA Latest Predicted Value"
              value={(data.summary?.arima_latest_prediction ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            />
          </div>

          <ChartCard
            title="BTC-USD Historical + ARIMA Forecast"
            className="forecast-card"
            kicker="Future Prediction Graph"
          >
            <Line
              plugins={[forecastAreaPlugin]}
              data={{
                labels,
                datasets: [
                  {
                    label: "Historical BTC-USD",
                    data: historicalSeries,
                    borderColor: "#38bdf8",
                    backgroundColor: "rgba(56, 189, 248, 0.24)",
                    pointBackgroundColor: "#7dd3fc",
                    pointBorderColor: "#0b203e",
                    fill: true,
                    tension: 0.3,
                  },
                  {
                    label: "Forecasted BTC-USD",
                    data: forecastSeries,
                    borderColor: "#f97316",
                    pointBackgroundColor: "#fb923c",
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

          <div className="card">
            <h3>Summary Analysis</h3>
            <p>
              <strong>Current Trend:</strong>{" "}
              <span className={trendColor}>{trend.toLowerCase()}</span>
            </p>
            <p>
              <strong>Predicted Short-Term Movement:</strong> {movement}
            </p>
            <p>
              <strong>Key Insights:</strong>
            </p>
            <ul>
              {(data.summary?.insights || []).map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
            <p>
              <strong>Model Explanation:</strong> {data.summary?.explanation || "-"}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

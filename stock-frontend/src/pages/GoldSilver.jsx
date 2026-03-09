import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChartCard from "../components/ChartCard";
import StatCard from "../components/StatCard";
import { registerCharts } from "../charts/registerCharts";

registerCharts();

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: "top" },
    tooltip: { mode: "index", intersect: false },
  },
  interaction: { mode: "index", intersect: false },
};

const predictionChartOptions = {
  ...chartOptions,
  scales: {
    x: {
      offset: true,
      ticks: {
        autoSkip: true,
        maxTicksLimit: 8,
        maxRotation: 0,
        minRotation: 0,
        padding: 12,
      },
    },
  },
};

export default function GoldSilver() {
  const [trend, setTrend] = useState({ dates: [], gold_prices: [], silver_prices: [] });
  const [correlation, setCorrelation] = useState({ dates: [], correlation: [] });
  const [prediction, setPrediction] = useState({
    dates: [],
    gold_actual: [],
    silver_actual: [],
    gold_lr_prediction: [],
    silver_lr_prediction: [],
    gold_arima_prediction: [],
    silver_arima_prediction: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [trendRes, corrRes, predRes] = await Promise.all([
          api.get("/gold-silver-trend/"),
          api.get("/gold-silver-correlation/"),
          api.get("/gold-silver-prediction/"),
        ]);
        setTrend(trendRes.data || { dates: [], gold_prices: [], silver_prices: [] });
        setCorrelation(corrRes.data || { dates: [], correlation: [] });
        setPrediction(
          predRes.data || {
            dates: [],
            gold_actual: [],
            silver_actual: [],
            gold_lr_prediction: [],
            silver_lr_prediction: [],
            gold_arima_prediction: [],
            silver_arima_prediction: [],
          }
        );
      } catch {
        setError("Unable to load Gold/Silver analytics right now.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const latestGold = useMemo(
    () => (trend.gold_prices.length ? trend.gold_prices[trend.gold_prices.length - 1] : 0),
    [trend.gold_prices]
  );
  const latestSilver = useMemo(
    () => (trend.silver_prices.length ? trend.silver_prices[trend.silver_prices.length - 1] : 0),
    [trend.silver_prices]
  );
  const latestCorr = useMemo(
    () =>
      correlation.correlation.length
        ? correlation.correlation[correlation.correlation.length - 1]
        : 0,
    [correlation.correlation]
  );

  const trendOneYear = useMemo(() => {
    const days = 365;
    return {
      dates: trend.dates.slice(-days),
      gold_prices: trend.gold_prices.slice(-days),
      silver_prices: trend.silver_prices.slice(-days),
    };
  }, [trend]);

  const correlationOneYear = useMemo(() => {
    const days = 365;
    return {
      dates: correlation.dates.slice(-days),
      correlation: correlation.correlation.slice(-days),
    };
  }, [correlation]);

  const predictionOneYear = useMemo(() => {
    const historyDays = 252; // ~1 year of trading days
    const totalLen = prediction.dates.length;
    if (!totalLen) return prediction;

    const futureDays = 7;
    const start = Math.max(0, totalLen - (historyDays + futureDays));
    return {
      dates: prediction.dates.slice(start),
      gold_actual: prediction.gold_actual.slice(start),
      silver_actual: prediction.silver_actual.slice(start),
      gold_lr_prediction: prediction.gold_lr_prediction.slice(start),
      silver_lr_prediction: prediction.silver_lr_prediction.slice(start),
      gold_arima_prediction: prediction.gold_arima_prediction.slice(start),
      silver_arima_prediction: prediction.silver_arima_prediction.slice(start),
    };
  }, [prediction]);

  const predictionFocus = useMemo(() => {
    const focusHistoryDays = 45;
    const totalLen = predictionOneYear.dates.length;
    if (!totalLen) return predictionOneYear;
    const futureDays = 7;
    const start = Math.max(0, totalLen - (focusHistoryDays + futureDays));
    return {
      dates: predictionOneYear.dates.slice(start),
      gold_actual: predictionOneYear.gold_actual.slice(start),
      silver_actual: predictionOneYear.silver_actual.slice(start),
      gold_lr_prediction: predictionOneYear.gold_lr_prediction.slice(start),
      silver_lr_prediction: predictionOneYear.silver_lr_prediction.slice(start),
      gold_arima_prediction: predictionOneYear.gold_arima_prediction.slice(start),
      silver_arima_prediction: predictionOneYear.silver_arima_prediction.slice(start),
    };
  }, [predictionOneYear]);

  const buildConnectedPrediction = (actualSeries, predictionSeries) => {
    const result = new Array(actualSeries.length).fill(null);
    const lastActualIndex = actualSeries.reduce(
      (lastIndex, value, index) => (value !== null && value !== undefined ? index : lastIndex),
      -1
    );

    if (lastActualIndex >= 0) {
      result[lastActualIndex] = actualSeries[lastActualIndex];
    }

    predictionSeries.forEach((value, index) => {
      if (index > lastActualIndex && value !== null && value !== undefined) {
        result[index] = value;
      }
    });

    return result;
  };

  const goldLrConnected = useMemo(
    () => buildConnectedPrediction(predictionFocus.gold_actual, predictionFocus.gold_lr_prediction),
    [predictionFocus]
  );
  const goldArimaConnected = useMemo(
    () =>
      buildConnectedPrediction(
        predictionFocus.gold_actual,
        predictionFocus.gold_arima_prediction
      ),
    [predictionFocus]
  );
  const silverLrConnected = useMemo(
    () =>
      buildConnectedPrediction(
        predictionFocus.silver_actual,
        predictionFocus.silver_lr_prediction
      ),
    [predictionFocus]
  );
  const silverArimaConnected = useMemo(
    () =>
      buildConnectedPrediction(
        predictionFocus.silver_actual,
        predictionFocus.silver_arima_prediction
      ),
    [predictionFocus]
  );

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <h2 className="page-title">Gold and Silver Analysis</h2>
          {error ? <p className="loss-text">{error}</p> : null}
          {loading ? <p className="muted-text">Loading Gold/Silver live analytics...</p> : null}

          <div className="stats-grid">
            <StatCard
              label="Latest Gold Price"
              value={latestGold ? `$${latestGold.toFixed(2)}` : "-"}
            />
            <StatCard
              label="Latest Silver Price"
              value={latestSilver ? `$${latestSilver.toFixed(2)}` : "-"}
            />
            <StatCard
              label="Latest 30D Correlation"
              value={Number.isFinite(latestCorr) ? latestCorr.toFixed(4) : "-"}
            />
          </div>

          <ChartCard title="Gold vs Silver Trend (3 Years)">
            <Line
              data={{
                labels: trendOneYear.dates,
                datasets: [
                  {
                    label: "Gold",
                    data: trendOneYear.gold_prices,
                    borderColor: "#f59e0b",
                    backgroundColor: "rgba(245,158,11,0.18)",
                    tension: 0.2,
                    pointRadius: 0,
                  },
                  {
                    label: "Silver",
                    data: trendOneYear.silver_prices,
                    borderColor: "#94a3b8",
                    backgroundColor: "rgba(148,163,184,0.18)",
                    tension: 0.2,
                    pointRadius: 0,
                  },
                ],
              }}
              options={predictionChartOptions}
            />
          </ChartCard>

          <ChartCard title="Gold-Silver Rolling Correlation (30 Days)">
            <Line
              data={{
                labels: correlationOneYear.dates,
                datasets: [
                  {
                    label: "Correlation",
                    data: correlationOneYear.correlation,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37,99,235,0.16)",
                    tension: 0.2,
                    pointRadius: 0,
                  },
                ],
              }}
              options={{
                ...chartOptions,
                scales: {
                  y: { min: -1, max: 1, title: { display: true, text: "Correlation" } },
                },
              }}
            />
          </ChartCard>

          <ChartCard title="Gold Price Prediction (LR vs ARIMA, Next 7 Days)">
            <Line
              data={{
                labels: predictionFocus.dates,
                datasets: [
                  {
                    label: "Actual Price",
                    data: predictionFocus.gold_actual,
                    borderColor: "#d97706",
                    tension: 0.15,
                    pointRadius: 0,
                    borderWidth: 2,
                  },
                  {
                    label: "Linear Regression Prediction",
                    data: goldLrConnected,
                    borderColor: "#2563eb",
                    borderDash: [2, 6],
                    tension: 0.15,
                    pointRadius: 3,
                    borderWidth: 3,
                    spanGaps: true,
                  },
                  {
                    label: "ARIMA Prediction",
                    data: goldArimaConnected,
                    borderColor: "#16a34a",
                    borderDash: [2, 6],
                    tension: 0.15,
                    pointRadius: 3,
                    borderWidth: 3,
                    spanGaps: true,
                  },
                ],
              }}
              options={predictionChartOptions}
            />
          </ChartCard>

          <ChartCard title="Silver Price Prediction (LR vs ARIMA, Next 7 Days)">
            <Line
              data={{
                labels: predictionFocus.dates,
                datasets: [
                  {
                    label: "Actual Price",
                    data: predictionFocus.silver_actual,
                    borderColor: "#64748b",
                    tension: 0.15,
                    pointRadius: 0,
                    borderWidth: 2,
                  },
                  {
                    label: "Linear Regression Prediction",
                    data: silverLrConnected,
                    borderColor: "#2563eb",
                    borderDash: [2, 6],
                    tension: 0.15,
                    pointRadius: 3,
                    borderWidth: 3,
                    spanGaps: true,
                  },
                  {
                    label: "ARIMA Prediction",
                    data: silverArimaConnected,
                    borderColor: "#16a34a",
                    borderDash: [2, 6],
                    tension: 0.15,
                    pointRadius: 3,
                    borderWidth: 3,
                    spanGaps: true,
                  },
                ],
              }}
              options={chartOptions}
            />
          </ChartCard>
        </main>
      </div>
    </div>
  );
}

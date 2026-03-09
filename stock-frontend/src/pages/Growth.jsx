import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line, Scatter } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChartCard from "../components/ChartCard";
import StatCard from "../components/StatCard";
import { registerCharts } from "../charts/registerCharts";
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

const SECTOR_COLORS = [
  "#60a5fa",
  "#22c55e",
  "#f59e0b",
  "#a78bfa",
  "#f97316",
  "#14b8a6",
  "#ef4444",
  "#84cc16",
];

export default function Growth() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    top_growth_sectors: [],
    sector_allocation: [],
    pca_points: [],
    forecast: {
      history_labels: [],
      history_values: [],
      forecast_labels: [],
      forecast_values: [],
    },
  });

  useEffect(() => {
    const run = async () => {
      const symbols = getPortfolioSymbols();
      if (!symbols.length) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await api.get("/growth/analysis/", {
          params: { symbols: symbols.join(",") },
        });
        setData(response.data || data);
        setError("");
      } catch {
        setError("Unable to load growth analytics.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const historyValues = data.forecast?.history_values || [];
  const forecastValues = data.forecast?.forecast_values || [];
  const forecastLabels = data.forecast?.forecast_labels || [];
  const combinedLabels = [...(data.forecast?.history_labels || []), ...forecastLabels];
  const historicalSeries = [...historyValues, ...new Array(forecastValues.length).fill(null)];
  const forecastSeries = [...new Array(Math.max(historyValues.length - 1, 0)).fill(null), historyValues.at(-1) ?? null, ...forecastValues];

  const totalValue = historyValues.at(-1) || 0;
  const futureValue = forecastValues.at(-1) || totalValue;
  const minValue = historyValues.length ? Math.min(...historyValues) : 0;
  const maxValue = historyValues.length ? Math.max(...historyValues) : 0;
  const profitLoss = historyValues.length ? totalValue - historyValues[0] : 0;
  const bestSector = data.top_growth_sectors?.[0]?.sector || "-";

  const sectorColorMap = useMemo(() => {
    const map = new Map();
    const sectors = data.sector_allocation?.map((row) => row.sector) || [];
    sectors.forEach((sector, index) => {
      map.set(sector, SECTOR_COLORS[index % SECTOR_COLORS.length]);
    });
    return map;
  }, [data.sector_allocation]);

  const pcaDatasets = useMemo(() => {
    const grouped = new Map();
    for (const row of data.pca_points || []) {
      const sector = row.sector || "Unknown";
      if (!grouped.has(sector)) grouped.set(sector, []);
      grouped.get(sector).push({ x: row.x, y: row.y });
    }
    return Array.from(grouped.entries()).map(([sector, points], idx) => ({
      label: sector,
      data: points,
      pointRadius: 5,
      pointHoverRadius: 7,
      backgroundColor: sectorColorMap.get(sector) || SECTOR_COLORS[idx % SECTOR_COLORS.length],
    }));
  }, [data.pca_points, sectorColorMap]);

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <div className="card">
            <h2>Portfolio Growth</h2>
            {error ? <p className="loss-text">{error}</p> : null}
            {loading ? <p className="muted-text">Loading growth analytics...</p> : null}
            <div className="stats-grid">
              <StatCard label="Total Portfolio Value" value={totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
              <StatCard label="Profit and Loss" value={profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
              <StatCard label="7-Day Forecast Value" value={futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
              <StatCard label="Minimum Value" value={minValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
              <StatCard label="Maximum Value" value={maxValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
              <StatCard label="Top Growth Sector" value={bestSector} />
            </div>
          </div>

          <ChartCard title="Top Growth Sectors">
            <Bar
              data={{
                labels: (data.top_growth_sectors || []).map((row) => row.sector),
                datasets: [
                  {
                    label: "Growth %",
                    data: (data.top_growth_sectors || []).map((row) => row.growth_pct),
                    backgroundColor: (data.top_growth_sectors || []).map(
                      (_, idx) => SECTOR_COLORS[idx % SECTOR_COLORS.length]
                    ),
                    borderRadius: 8,
                  },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
              }}
            />
          </ChartCard>

          <ChartCard title="Sector-wise Allocation">
            <Doughnut
              data={{
                labels: (data.sector_allocation || []).map((row) => `${row.sector} (${row.allocation_pct}%)`),
                datasets: [
                  {
                    data: (data.sector_allocation || []).map((row) => row.value),
                    backgroundColor: (data.sector_allocation || []).map(
                      (row, idx) => sectorColorMap.get(row.sector) || SECTOR_COLORS[idx % SECTOR_COLORS.length]
                    ),
                    borderWidth: 1.5,
                    borderColor: "rgba(15, 23, 42, 0.75)",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "right",
                    labels: { color: "#dbe6ff", boxWidth: 12 },
                  },
                },
              }}
            />
          </ChartCard>

          <ChartCard title="PCA Scatter Plot (Portfolio Stocks)">
            <Scatter
              data={{ datasets: pcaDatasets }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "right" } },
                scales: {
                  x: { title: { display: true, text: "PC1" } },
                  y: { title: { display: true, text: "PC2" } },
                },
              }}
            />
          </ChartCard>

          <ChartCard title="7-Day Linear Regression Forecast">
            <Line
              data={{
                labels: combinedLabels,
                datasets: [
                  {
                    label: "Historical Portfolio Value",
                    data: historicalSeries,
                    borderColor: "#60a5fa",
                    backgroundColor: "rgba(96,165,250,0.18)",
                    tension: 0.35,
                    fill: false,
                  },
                  {
                    label: "Predicted Next 7 Days",
                    data: forecastSeries,
                    borderColor: "#f59e0b",
                    backgroundColor: "rgba(245,158,11,0.14)",
                    borderDash: [6, 5],
                    tension: 0.35,
                    fill: false,
                    spanGaps: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "top" },
                },
              }}
            />
          </ChartCard>
        </main>
      </div>
    </div>
  );
}

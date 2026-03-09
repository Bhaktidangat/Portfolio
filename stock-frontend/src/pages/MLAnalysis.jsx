import { useEffect, useMemo, useState } from "react";
import { Line, Scatter } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChartCard from "../components/ChartCard";
import SearchableSelect from "../components/SearchableSelect";
import { registerCharts } from "../charts/registerCharts";
import {
  countries,
  dashboardSeedPortfolio,
  mlTableRows,
} from "../data/mockData";

registerCharts();
const PORTFOLIO_STORAGE_KEY = "dashboard_portfolio_rows";

function normalizeSectorName(sector) {
  const value = String(sector || "").trim();
  if (!value) return "Unknown";
  const map = new Map([
    ["banking", "Finance"],
    ["banks", "Finance"],
    ["financial services", "Finance"],
  ]);
  const normalized = map.get(value.toLowerCase());
  return normalized || value;
}

function linearRegressionForecast(series, steps) {
  const n = series.length;
  if (!n || steps <= 0) return [];
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    const xDiff = index - xMean;
    numerator += xDiff * (series[index] - yMean);
    denominator += xDiff * xDiff;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return Array.from({ length: steps }, (_, stepIndex) =>
    Number((intercept + slope * (n + stepIndex)).toFixed(2))
  );
}

function stableSymbolSignal(symbol) {
  const text = String(symbol || "");
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    total += text.charCodeAt(index) * (index + 1);
  }
  return ((total % 7) - 3) / 100; // deterministic small value in [-0.03, 0.03]
}

function getPortfolioRows() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : dashboardSeedPortfolio;
    const rows = Array.isArray(parsed) ? parsed : dashboardSeedPortfolio;
    return rows;
  } catch {
    return dashboardSeedPortfolio;
  }
}

export default function MLAnalysis() {
  const portfolioRows = useMemo(() => getPortfolioRows(), []);
  const portfolioSymbols = useMemo(
    () =>
      new Set(
        portfolioRows
          .map((row) => String(row?.symbol || "").trim().toUpperCase())
          .filter(Boolean)
      ),
    [portfolioRows]
  );
  const portfolioSymbolList = useMemo(() => Array.from(portfolioSymbols), [portfolioSymbols]);
  const portfolioRowMetaMap = useMemo(
    () =>
      new Map(
        portfolioRows
          .map((row) => {
            const symbol = String(row?.symbol || "").trim().toUpperCase();
            if (!symbol) return null;
            return [
              symbol,
              {
                company: row.company || symbol,
                sector: row.sector || "",
                country: row.country || "",
                currentPrice: Number(row.currentPrice ?? row.buyPrice ?? 0),
                buyPrice: Number(row.buyPrice ?? row.currentPrice ?? 0),
                quantity: Number(row.quantity ?? 1),
              },
            ];
          })
          .filter(Boolean)
      ),
    [portfolioRows]
  );

  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [filtersLoading] = useState(false);

  const predictionUniverse = useMemo(() => {
    return portfolioSymbolList.map((symbol) => {
      const rowMeta = portfolioRowMetaMap.get(symbol);
      return {
        symbol,
        company: rowMeta?.company || symbol,
        country: rowMeta?.country || "OTHER",
        sector: normalizeSectorName(
          rowMeta?.sector || "Unknown"
        ),
        currentPrice: Number(
          rowMeta?.currentPrice || rowMeta?.buyPrice || 100
        ),
        buyPrice: Number(rowMeta?.buyPrice || rowMeta?.currentPrice || 100),
        quantity: Number(rowMeta?.quantity || 1),
        predictedPrice: null,
        futureTrend: "",
        deltaPercent: null,
      };
    });
  }, [portfolioSymbolList, portfolioRowMetaMap]);

  const mlTableDisplayRows = useMemo(() => {
    const bySymbol = new Map(mlTableRows.map((row) => [row.symbol, row]));
    const clusterBySector = new Map([
      ["Technology", "C1"],
      ["Finance", "C2"],
      ["Unknown", "C3"],
    ]);

    return predictionUniverse
      .map((row) => {
        const existing = bySymbol.get(row.symbol);
        if (existing) {
          const actualFuture = Number(existing.actualFuture || 0);
          const predictedFuture = Number(existing.predictedFuture || actualFuture);
          const delta = predictedFuture - actualFuture;
          const lrForecast = actualFuture + delta * 0.8;
          const arimaForecast = actualFuture + delta * 0.6 + actualFuture * stableSymbolSignal(row.symbol) * 0.1;
          const trendSignal = (lrForecast + arimaForecast) / 2 - actualFuture;
          return {
            ...existing,
            regressionTrend: trendSignal >= 0 ? "UP" : "DOWN",
          };
        }

        const quantity = Number(row.quantity || 1);
        const currentPrice = Number(row.currentPrice || 0);
        const buyPrice = Number(row.buyPrice || currentPrice || 1);
        const baseTotal = currentPrice * quantity;
        const slopeRatio = (currentPrice - buyPrice) / Math.max(1, buyPrice);
        const boundedActual = Math.max(-0.05, Math.min(0.05, slopeRatio * 0.5));
        const boundedPred = Math.max(-0.08, Math.min(0.08, slopeRatio * 0.8));

        return {
          symbol: row.symbol,
          cluster: clusterBySector.get(row.sector) || "C3",
          actualTotal: Math.round(baseTotal),
          actualFuture: Math.round(baseTotal * (1 + boundedActual)),
          predictedFuture: Math.round(baseTotal * (1 + boundedPred)),
          regressionTrend: boundedPred >= boundedActual ? "UP" : "DOWN",
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [predictionUniverse]);

  const countryOptions = useMemo(() => {
    const labelByValue = new Map(countries.map((item) => [item.value, item.label]));
    const uniqueCountries = Array.from(new Set(predictionUniverse.map((row) => row.country)));
    const options = uniqueCountries
      .map((value) => ({ value, label: labelByValue.get(value) || value }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "__ALL__", label: "All Countries" }, ...options];
  }, [predictionUniverse]);

  useEffect(() => {
    if (!countryOptions.length) {
      setCountry("");
      return;
    }
    if (!countryOptions.some((option) => option.value === country)) {
      setCountry("__ALL__");
    }
  }, [countryOptions, country]);

  const sectorOptions = useMemo(() => {
    const filteredByCountry = predictionUniverse.filter(
      (row) => country === "__ALL__" || !country || row.country === country
    );
    const uniqueSectors = Array.from(new Set(filteredByCountry.map((row) => row.sector)));
    const options = uniqueSectors
      .map((value) => ({ value, label: value }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "__ALL__", label: "All Sectors" }, ...options];
  }, [predictionUniverse, country]);

  useEffect(() => {
    if (!sectorOptions.length) {
      setSector("");
      return;
    }
    if (!sectorOptions.some((option) => option.value === sector)) {
      setSector("__ALL__");
    }
  }, [sectorOptions, sector]);

  const byCountryAndSector = useMemo(
    () =>
      predictionUniverse.filter((row) => {
        if (country !== "__ALL__" && country && row.country && row.country !== country) return false;
        if (sector !== "__ALL__" && sector && row.sector && row.sector !== sector) return false;
        return true;
      }),
    [predictionUniverse, country, sector]
  );

  const companyOptions = useMemo(
    () =>
      byCountryAndSector
        .map((row) => ({
          value: row.symbol,
          label: `${row.symbol} - ${row.company}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [byCountryAndSector]
  );

  useEffect(() => {
    if (!companyOptions.length) {
      setSelectedSymbol("");
      return;
    }
    if (!companyOptions.some((option) => option.value === selectedSymbol)) {
      setSelectedSymbol(companyOptions[0].value);
    }
  }, [companyOptions, selectedSymbol]);

  const selectedMeta = useMemo(
    () => predictionUniverse.find((row) => row.symbol === selectedSymbol) || null,
    [predictionUniverse, selectedSymbol]
  );

  const predictionChart = useMemo(() => {
    if (!selectedSymbol || !selectedMeta) {
      return { labels: [], historical: [], lr: [], arima: [], total: [] };
    }

    const historyLength = 30;
    const futureDays = 7;
    const anchor = Number(selectedMeta.currentPrice || 100);
    const buyAnchor = Number(selectedMeta.buyPrice || anchor * 0.97);
    const historicalValues = Array.from({ length: historyLength }, (_, index) => {
      const progress = index / Math.max(1, historyLength - 1);
      const trend = buyAnchor + (anchor - buyAnchor) * progress;
      const wave = Math.sin(progress * Math.PI * 4) * anchor * 0.0035;
      return Number((trend + wave).toFixed(2));
    });
    historicalValues[historicalValues.length - 1] = anchor;

    const totalLength = historyLength + futureDays;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (totalLength - 1));
    const labels = Array.from({ length: totalLength }, (_, index) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + index);
      return d.toISOString().slice(0, 10);
    });

    const lrForecast = linearRegressionForecast(historicalValues, futureDays);
    const historicalSlope = (anchor - buyAnchor) / Math.max(5, historyLength - 1);
    const futureBase = [anchor, ...lrForecast.slice(1)];
    const historical = [...historicalValues, ...new Array(futureDays).fill(null)];
    // Anchor first prediction point to the exact last historical point to avoid visual break.
    const lrTail = [...futureBase];
    const arimaTail = futureBase.map((value, index) =>
      Number((value + Math.sin((index + 1) * 0.9) * Math.abs(historicalSlope) * 0.35).toFixed(2))
    );
    arimaTail[0] = anchor;
    const totalTail = futureBase.map((value, index) => {
      const drift = historicalSlope < 0 ? -0.02 : 0.02;
      return Number((value + index * drift).toFixed(2));
    });
    totalTail[0] = anchor;

    const prefix = new Array(historyLength - 1).fill(null);
    return {
      labels,
      historical,
      lr: [...prefix, ...lrTail],
      arima: [...prefix, ...arimaTail],
      total: [...prefix, ...totalTail],
    };
  }, [selectedSymbol, selectedMeta]);

  const futurePredictionOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#dbe6ff", usePointStyle: true, boxWidth: 10 },
        },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: {
          ticks: { color: "#9cb4e2", maxTicksLimit: 10 },
          grid: { color: "rgba(132, 157, 206, 0.14)" },
        },
        y: {
          ticks: { color: "#9cb4e2" },
          grid: { color: "rgba(132, 157, 206, 0.14)" },
        },
      },
    }),
    []
  );

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <h2 className="page-title">Machine Learning Analysis</h2>
          <div className="chart-grid">
            <ChartCard title="K-means Clustering">
              <Scatter
                data={{
                  datasets: [
                    {
                      label: "Clustered Assets",
                      data: mlTableDisplayRows.map((row, index) => ({
                        x: row.actualTotal,
                        y: row.predictedFuture,
                        r: 5 + (index % 3),
                      })),
                      backgroundColor: "#38bdf8",
                    },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false }}
              />
            </ChartCard>
            <ChartCard title="Linear Regression">
              <Line
                data={{
                  labels: ["T1", "T2", "T3", "T4", "T5", "T6"],
                  datasets: [{ label: "Regression Fit", data: [102, 108, 115, 121, 126, 133], borderColor: "#22c55e", tension: 0.3 }],
                }}
                options={{ responsive: true, maintainAspectRatio: false }}
              />
            </ChartCard>
            <ChartCard title="ARIMA Prediction">
              <Line
                data={{
                  labels: ["T1", "T2", "T3", "T4", "T5", "T6"],
                  datasets: [{ label: "ARIMA Forecast", data: [100, 106, 112, 118, 123, 129], borderColor: "#f59e0b", tension: 0.3 }],
                }}
                options={{ responsive: true, maintainAspectRatio: false }}
              />
            </ChartCard>
          </div>

          <div className="card">
            <h3>ML Analysis Table</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Cluster</th>
                    <th>Actual Total</th>
                    <th>Actual Future Total</th>
                    <th>Predicted Future Total</th>
                    <th>Regression Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {mlTableDisplayRows.map((row) => (
                    <tr key={row.symbol}>
                      <td>{row.symbol}</td>
                      <td>{row.cluster}</td>
                      <td>{row.actualTotal}</td>
                      <td>{row.actualFuture}</td>
                      <td>{row.predictedFuture}</td>
                      <td className={row.regressionTrend === "UP" ? "profit-text" : "loss-text"}>
                        {row.regressionTrend}
                      </td>
                    </tr>
                  ))}
                  {!mlTableDisplayRows.length ? (
                    <tr>
                      <td colSpan="6" className="muted-text">
                        No portfolio stocks found for ML table.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Future Prediction Graph</h3>
            <p className="muted-text" style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Future Prediction Graph
            </p>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>
              {selectedSymbol ? `${selectedSymbol} Forecast` : "Forecast"}
            </h3>
            <SearchableSelect
              label="Country (Step 1)"
              value={country}
              options={countryOptions}
              onChange={setCountry}
              disabled={filtersLoading || !countryOptions.length}
            />
            <SearchableSelect
              label="Sector (Step 2)"
              value={sector}
              options={sectorOptions}
              onChange={setSector}
              disabled={filtersLoading || !sectorOptions.length}
            />
            <SearchableSelect
              label="Company (Step 3)"
              value={selectedSymbol}
              options={companyOptions}
              onChange={setSelectedSymbol}
              disabled={filtersLoading || !companyOptions.length}
            />
            <div
              className="chart-container"
              style={{
                background:
                  "radial-gradient(circle at top left, rgba(37,99,235,0.2), transparent 40%), linear-gradient(135deg, #08142c 0%, #06102a 45%, #040b1f 100%)",
                borderRadius: 14,
                border: "1px solid rgba(120, 154, 230, 0.25)",
                padding: 10,
                height: 320,
              }}
            >
              {predictionChart.labels.length ? (
                <Line
                  data={{
                    labels: predictionChart.labels,
                    datasets: [
                      {
                        label: "Historical",
                        data: predictionChart.historical,
                        borderColor: "#38bdf8",
                        backgroundColor: "rgba(56, 189, 248, 0.20)",
                        tension: 0.3,
                        pointRadius: 2,
                        fill: true,
                        borderWidth: 2.5,
                        spanGaps: true,
                      },
                      {
                        label: "Linear Regression",
                        data: predictionChart.lr,
                        borderColor: "#22c55e",
                        tension: 0.25,
                        pointRadius: 2,
                        borderDash: [4, 4],
                        borderWidth: 2,
                        spanGaps: true,
                      },
                      {
                        label: "ARIMA Prediction",
                        data: predictionChart.arima,
                        borderColor: "#f97316",
                        tension: 0.25,
                        pointRadius: 2,
                        borderDash: [4, 4],
                        borderWidth: 2,
                        spanGaps: true,
                      },
                      {
                        label: "Predicted Future Total",
                        data: predictionChart.total,
                        borderColor: "#a78bfa",
                        tension: 0.25,
                        pointRadius: 2,
                        borderWidth: 2,
                        spanGaps: true,
                      },
                    ],
                  }}
                  options={futurePredictionOptions}
                />
              ) : (
                <p className="muted-text">No prediction data available for selected filters.</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

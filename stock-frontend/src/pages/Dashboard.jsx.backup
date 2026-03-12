import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import SearchableSelect from "../components/SearchableSelect";
import PortfolioTable from "../components/PortfolioTable";
import ChartCard from "../components/ChartCard";
import { registerCharts } from "../charts/registerCharts";
import api from "../api/axios";
import { countries, dashboardSeedPortfolio } from "../data/mockData";

registerCharts();
const PORTFOLIO_STORAGE_KEY = "dashboard_portfolio_rows";
const BUILDER_CONTEXT_KEY = "dashboard_builder_context";

function normalizeCompanyName(row, fallbackSymbol = "") {
  const symbol = String(fallbackSymbol || row?.symbol || "").trim().toUpperCase();
  const fromRow = String(row?.company || row?.company_name || "").trim();
  if (fromRow) return fromRow;
  return symbol || "Unknown";
}

function getInitialPortfolioRows() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return dashboardSeedPortfolio;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return dashboardSeedPortfolio;
    return parsed.map((row) => ({
      ...row,
      company: normalizeCompanyName(row, row?.symbol),
    }));
  } catch {
    return dashboardSeedPortfolio;
  }
}

function getInitialBuilderContext() {
  try {
    const raw = localStorage.getItem(BUILDER_CONTEXT_KEY);
    if (!raw) return { country: "", sector: "", sectorOptions: [], liveStocks: [] };
    const parsed = JSON.parse(raw);
    return {
      country: parsed?.country || "",
      sector: parsed?.sector || "",
      sectorOptions: Array.isArray(parsed?.sectorOptions) ? parsed.sectorOptions : [],
      liveStocks: Array.isArray(parsed?.liveStocks) ? parsed.liveStocks : [],
    };
  } catch {
    return { country: "", sector: "", sectorOptions: [], liveStocks: [] };
  }
}

export default function Dashboard() {
  const initialContext = getInitialBuilderContext();
  const [country, setCountry] = useState(initialContext.country);
  const [sector, setSector] = useState(initialContext.sector);
  const [stockSymbol, setStockSymbol] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sectorOptions, setSectorOptions] = useState(initialContext.sectorOptions);
  const [liveStocks, setLiveStocks] = useState(initialContext.liveStocks);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stocksError, setStocksError] = useState("");
  const [portfolioRows, setPortfolioRows] = useState(getInitialPortfolioRows);

  const currency = countries.find((item) => item.value === country)?.currency || "-";

  const stockOptions = useMemo(
    () =>
      liveStocks.map((stock) => ({
        value: stock.symbol,
        label: `${stock.symbol} - ${stock.company_name || stock.symbol}`,
      })),
    [liveStocks]
  );

  const loadSectors = async () => {
    try {
      const response = await api.get("/sectors/");
      const loaded = (response.data?.sectors || []).map((name) => ({
        value: name,
        label: name,
      }));
      setSectorOptions(loaded);
      if (!sector && loaded.length) {
        setSector(loaded[0].value);
      }
    } catch {
      setStocksError("Unable to load sectors.");
    }
  };

  const loadStocks = async (sectorName, countryCode = "") => {
    if (!sectorName) return;
    setLoadingStocks(true);
    try {
      const response = await api.get("/stocks/", {
        params: { sector: sectorName, country: countryCode || undefined },
      });
      const rows = response.data || [];
      setLiveStocks(rows);
      setStocksError("");
      setPortfolioRows((prev) =>
        prev.map((row) => {
          const live = rows.find((item) => item.symbol === row.symbol);
          if (!live) return row;
          return {
            ...row,
            company: normalizeCompanyName(live, row.symbol),
            company_name: normalizeCompanyName(live, row.symbol),
            currentPrice: Number(live.price ?? row.currentPrice),
            peRatio: Number(live.pe_ratio ?? row.peRatio),
            sector: live.sector || row.sector || sector || "Unknown",
            country: row.country || country || "OTHER",
          };
        })
      );
    } catch {
      setStocksError("Unable to fetch live stocks for selected sector.");
    } finally {
      setLoadingStocks(false);
    }
  };

  useEffect(() => {
    loadSectors();
  }, []);

  useEffect(() => {
    if (!sector) return;
    setStockSymbol("");
    loadStocks(sector, country);
  }, [sector, country]);

  useEffect(() => {
    if (!sector) return;
    const intervalId = setInterval(() => {
      loadStocks(sector, country);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [sector, country]);

  useEffect(() => {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolioRows));
  }, [portfolioRows]);

  useEffect(() => {
    localStorage.setItem(
      BUILDER_CONTEXT_KEY,
      JSON.stringify({ country, sector, sectorOptions, liveStocks })
    );
  }, [country, sector, sectorOptions, liveStocks]);

  const addStock = () => {
    if (!stockSymbol) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return;
    const selected = liveStocks.find((item) => item.symbol === stockSymbol);
    if (!selected) return;
    const currentPrice = Number(selected.price || 0);
    const maxPrice = Number(selected.max_price || currentPrice || 1);
    const discountPct = maxPrice > 0 ? ((maxPrice - currentPrice) / maxPrice) * 100 : 0;

    setPortfolioRows((prev) => {
      if (prev.some((row) => row.symbol === selected.symbol)) return prev;
      return [
        ...prev,
        {
          symbol: selected.symbol,
          company: normalizeCompanyName(selected, selected.symbol),
          company_name: normalizeCompanyName(selected, selected.symbol),
          quantity: parsedQuantity,
          buyPrice: currentPrice * 0.97,
          currentPrice,
          peRatio: Number(selected.pe_ratio || 0),
          discountPct,
          sector: selected.sector || sector || "Unknown",
          country: country || "OTHER",
        },
      ];
    });
  };

  const editRow = (symbol) => {
    const raw = window.prompt("Enter updated quantity");
    const nextQuantity = Number(raw);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;
    setPortfolioRows((prev) =>
      prev.map((row) => (row.symbol === symbol ? { ...row, quantity: nextQuantity } : row))
    );
  };

  const removeRow = (symbol) => {
    setPortfolioRows((prev) => prev.filter((row) => row.symbol !== symbol));
  };

  const chartLabels = portfolioRows.map((row) => row.symbol);
  const profitLossData = portfolioRows.map((row) => (row.currentPrice - row.buyPrice) * row.quantity);
  const discountData = portfolioRows.map((row) => row.discountPct);
  const opportunityData = portfolioRows.map((row) => row.currentPrice * row.quantity * (row.discountPct / 100));
  const peData = portfolioRows.map((row) => row.peRatio);

  const chartOptions = { responsive: true, maintainAspectRatio: false };

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <div className="card">
            <h2>Portfolio Builder Dashboard</h2>
            <p className="muted-text">Selected Currency: {currency}</p>
            <p className="muted-text">
              {loadingStocks ? "Loading live stocks..." : `Live stocks in sector: ${liveStocks.length}`}
            </p>
            {stocksError && <p className="loss-text">{stocksError}</p>}

            <div className="builder-grid dashboard-builder-grid">
              <SearchableSelect
                label="Country (Step 1)"
                value={country}
                options={countries.map((item) => ({ value: item.value, label: item.label }))}
                onChange={setCountry}
              />
              <SearchableSelect
                label="Sector (Step 2)"
                value={sector}
                options={sectorOptions}
                onChange={setSector}
              />
              <SearchableSelect
                label="Stock (Step 3)"
                value={stockSymbol}
                options={stockOptions}
                onChange={setStockSymbol}
                showSearch={false}
              />
            </div>
            <div className="add-stock-footer">
              <label>Quantity (Step 4)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Enter quantity"
              />
              <label>Add Stock (Step 5)</label>
              <button type="button" className="btn dashboard-add-btn" onClick={addStock}>
                Add To Portfolio
              </button>
            </div>
          </div>

          <PortfolioTable rows={portfolioRows} onEdit={editRow} onRemove={removeRow} />

          <div className="chart-grid">
            <ChartCard title="Profit and Loss">
              <Bar
                data={{
                  labels: chartLabels,
                  datasets: [{ label: "Profit/Loss", data: profitLossData, backgroundColor: "#3b82f6" }],
                }}
                options={chartOptions}
              />
            </ChartCard>
            <ChartCard title="Discount Percentage">
              <Bar
                data={{
                  labels: chartLabels,
                  datasets: [{ label: "Discount %", data: discountData, backgroundColor: "#22c55e" }],
                }}
                options={chartOptions}
              />
            </ChartCard>
            <ChartCard title="Opportunity Value">
              <Bar
                data={{
                  labels: chartLabels,
                  datasets: [{ label: "Opportunity", data: opportunityData, backgroundColor: "#f59e0b" }],
                }}
                options={chartOptions}
              />
            </ChartCard>
            <ChartCard title="P/E Ratio">
              <Bar
                data={{
                  labels: chartLabels,
                  datasets: [{ label: "P/E Ratio", data: peData, backgroundColor: "#a855f7" }],
                }}
                options={chartOptions}
              />
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  );
}

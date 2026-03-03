import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import PortfolioTable from "../components/PortfolioTable";
import AddStockForm from "../components/AddStockForm";
import StockChart from "../components/StockChart";
import PerformanceCharts from "../components/PerformanceCharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState("Technology");
  const [sectorStockCache, setSectorStockCache] = useState({});
  const [portfolio, setPortfolio] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStocks = async (sector = selectedSector, force = false, applyToView = true) => {
    if (!force && sectorStockCache[sector]) {
      if (applyToView) {
        setStocks(sectorStockCache[sector]);
      }
      return;
    }

    const response = await api.get("/stocks/", { params: { sector } });
    if (applyToView) {
      setStocks(response.data);
    }
    setSectorStockCache((prev) => ({ ...prev, [sector]: response.data }));
  };

  const loadSectors = async () => {
    const response = await api.get("/sectors/");
    const loadedSectors = response.data?.sectors || [];
    setSectors(loadedSectors);
    if (loadedSectors.length && !loadedSectors.includes(selectedSector)) {
      setSelectedSector(loadedSectors[0]);
    }
  };

  const loadPortfolio = async () => {
    const [portfolioRes, totalRes] = await Promise.all([
      api.get("/portfolio/"),
      api.get("/portfolio/total/"),
    ]);

    setPortfolio(portfolioRes.data.stocks || []);
    setTotalValue(totalRes.data.total_value || 0);
  };

  const loadData = async () => {
    setError("");
    setLoading(true);
    try {
      await Promise.all([loadSectors(), loadStocks(selectedSector, true), loadPortfolio()]);
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedSector) return;
    loadStocks(selectedSector).catch(() => setError("Unable to load sector stocks."));
  }, [selectedSector]);

  useEffect(() => {
    if (!sectors.length) return;
    sectors
      .filter((sector) => sector !== selectedSector && !sectorStockCache[sector])
      .forEach((sector) => {
        loadStocks(sector, true, false).catch(() => {});
      });
  }, [sectors]);

  const handleAddStock = async (stockId, quantity) => {
    setError("");
    try {
      await api.post("/portfolio/add/", { stock_id: stockId, quantity });
      await loadPortfolio();
    } catch {
      setError("Unable to add stock.");
    }
  };

  const handleRemoveStock = async (stockId) => {
    setError("");
    try {
      await api.delete("/portfolio/remove/", { data: { stock_id: stockId } });
      await loadPortfolio();
    } catch {
      setError("Unable to remove stock.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login", { replace: true });
  };

  const summary = useMemo(() => {
    const items = portfolio || [];
    const totalProfitLoss = items.reduce(
      (sum, item) => sum + Number(item.profit_loss || 0),
      0
    );
    const peWeightedNumerator = items.reduce((sum, item) => {
      const pe = Number(item.pe_ratio || 0);
      const currentPrice = Number(item.current_price ?? item.stock?.price ?? 0);
      const qty = Number(item.quantity || 0);
      return sum + pe * currentPrice * qty;
    }, 0);
    const peWeightedDenominator = items.reduce((sum, item) => {
      const currentPrice = Number(item.current_price ?? item.stock?.price ?? 0);
      const qty = Number(item.quantity || 0);
      return sum + currentPrice * qty;
    }, 0);
    const portfolioPeRatio =
      peWeightedDenominator > 0 ? peWeightedNumerator / peWeightedDenominator : 0;

    const best = [...items].sort(
      (a, b) => Number(b.profit_loss || 0) - Number(a.profit_loss || 0)
    )[0];

    return {
      totalProfitLoss,
      portfolioPeRatio,
      bestPerformer: best
        ? `${best.stock.symbol} (${Number(best.profit_loss).toFixed(2)})`
        : "N/A",
    };
  }, [portfolio]);

  return (
    <div className="container dashboard-shell">
      <div className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">Portfolio Workspace</p>
          <h1>Stock Portfolio Dashboard</h1>
        </div>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading-text">Loading portfolio data...</p>}

      <div className="card hero-card">
        <div className="hero-card-content">
          <p className="hero-label">Total Portfolio Value</p>
          <h2>${Number(totalValue).toFixed(2)}</h2>
          <p className="hero-subtext">Live pricing synced from market feed.</p>
        </div>
        <div className="hero-chip">Market Pulse</div>
      </div>

      <div className="kpi-grid">
        <div className="card kpi-card">
          <p className="kpi-label">Best Performing Stock</p>
          <h3>{summary.bestPerformer}</h3>
        </div>
        <div className="card kpi-card">
          <p className="kpi-label">Profit / Loss</p>
          <h3
            className={
              summary.totalProfitLoss >= 0 ? "profit-text kpi-value" : "loss-text kpi-value"
            }
          >
            ${Number(summary.totalProfitLoss).toFixed(2)}
          </h3>
        </div>
        <div className="card kpi-card">
          <p className="kpi-label">Portfolio PE Ratio</p>
          <h3>{summary.portfolioPeRatio ? summary.portfolioPeRatio.toFixed(2) : "N/A"}</h3>
        </div>
      </div>

      <div className="card">
        <h3>Add Stock</h3>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </div>
        <AddStockForm stocks={stocks} onAdd={handleAddStock} />
      </div>

      <div className="card">
        <h3>Your Portfolio</h3>
        <PortfolioTable portfolioItems={portfolio} onRemove={handleRemoveStock} />
      </div>

      <div className="card">
        <h3>Stock Price Trend</h3>
        <StockChart stocks={stocks} />
      </div>

      <div className="card">
        <h3>Portfolio Analytics</h3>
        <PerformanceCharts portfolioItems={portfolio} />
      </div>
    </div>
  );
}

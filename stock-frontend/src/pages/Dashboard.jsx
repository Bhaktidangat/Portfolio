import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import SearchableSelect from "../components/SearchableSelect";
import PortfolioTable from "../components/PortfolioTable";
import ChartCard from "../components/ChartCard";
import { registerCharts } from "../charts/registerCharts";
import api from "../api/axios";
import { countries } from "../data/mockData";

registerCharts();

function normalizeCompanyName(row, fallbackSymbol = "") {
  const symbol = String(fallbackSymbol || row?.symbol || "").trim().toUpperCase();
  const fromRow = String(row?.company || row?.company_name || "").trim();
  if (fromRow) return fromRow;
  return symbol || "Unknown";
}

export default function Dashboard() {
  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [stockSymbol, setStockSymbol] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sectorOptions, setSectorOptions] = useState([]);
  const [liveStocks, setLiveStocks] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stocksError, setStocksError] = useState("");
  const [portfolioRows, setPortfolioRows] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const currency = countries.find((item) => item.value === country)?.currency || "-";
  const stockOptions = useMemo(
    () => liveStocks.map((stock) => ({
      value: stock.symbol,
      label: stock.symbol + " - " + (stock.company_name || stock.symbol),
    })),
    [liveStocks]
  );
  const fetchPortfolio = async () => {
    try {
      const response = await api.get("/portfolio/");
      const stocks = response.data?.stocks || [];
      const rows = stocks.map((item) => ({
        id: item.stock?.id,
        symbol: item.stock?.symbol,
        company: normalizeCompanyName(item.stock, item.stock?.symbol),
        company_name: normalizeCompanyName(item.stock, item.stock?.symbol),
        quantity: item.quantity,
        buyPrice: Number(item.buy_price || 0),
        currentPrice: Number(item.stock?.price || 0),
        peRatio: Number(item.stock?.pe_ratio || 0),
        sector: item.stock?.sector || "Unknown",
        discountPct: Number(item.stock?.price) > 0 ? parseFloat((((Number(item.buy_price || 0) - Number(item.stock?.price || 0)) / Number(item.buy_price || 1)) * 100).toFixed(2)) : 0,
      }));
      setPortfolioRows(rows);
    } catch { setStocksError("Unable to load portfolio."); }
    finally { setLoadingPortfolio(false); }
  };
  const loadSectors = async () => {
    try {
      const response = await api.get("/sectors/");
      const loaded = (response.data?.sectors || []).map((name) => ({ value: name, label: name }));
      setSectorOptions(loaded);
    } catch { setStocksError("Unable to load sectors."); }
  };
  const loadStocks = async (sectorName, countryCode = "") => {
    setLoadingStocks(true);
    try {
      const response = await api.get("/stocks/", { params: { sector: sectorName, country: countryCode || undefined } });
      setLiveStocks(response.data || []);
      setStocksError("");
    } catch { setStocksError("Unable to fetch live stocks."); }
    finally { setLoadingStocks(false); }
  };
  useEffect(() => { fetchPortfolio(); loadSectors(); }, []);
  useEffect(() => {
    const id = setInterval(() => loadStocks(sector, country), 60000);
    return () => clearInterval(id);
  }, [sector, country]);
useEffect(() => { if (sector) loadStocks(sector, country); }, [sector, country]);
  const addStock = async () => {
    if (!stockSymbol) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return;
    const selected = liveStocks.find((item) => item.symbol === stockSymbol);
    if (!selected) return;
    try {
      await api.post("/portfolio/add/", { stock_id: selected.id, quantity: parsedQuantity, buy_price: Number(selected.price || 0) });
      await fetchPortfolio();
      setStockSymbol("");
      setQuantity("1");
    } catch { setStocksError("Unable to add stock to portfolio."); }
  };
  const editRow = async (symbol) => {
    const raw = window.prompt("Enter updated quantity");
    const nextQuantity = Number(raw);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;
    const row = portfolioRows.find((r) => r.symbol === symbol);
    if (!row) return;
    try {
      await api.patch("/portfolio/update-buy-price/", { stock_id: row.id, buy_price: row.buyPrice });
      await fetchPortfolio();
    } catch { setStocksError("Unable to update stock."); }
  };
  const removeRow = async (symbol) => {
    const row = portfolioRows.find((r) => r.symbol === symbol);
    if (!row) return;
    try {
      await api.delete("/portfolio/remove/", { data: { stock_id: row.id } });
      await fetchPortfolio();
    } catch { setStocksError("Unable to remove stock."); }
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
            {loadingPortfolio && <p className="muted-text">Loading portfolio...</p>}
{loadingStocks && <p className="muted-text">⏳ Fetching live stock data, please wait...</p>}            
{stocksError && <p className="loss-text">{stocksError}</p>}
            <div className="builder-grid dashboard-builder-grid">
              <SearchableSelect label="Country (Step 1)" value={country} options={countries.map((item) => ({ value: item.value, label: item.label }))} onChange={setCountry} />
              <SearchableSelect label="Sector (Step 2)" value={sector} options={sectorOptions} onChange={setSector} />
              <SearchableSelect label="Stock (Step 3)" value={stockSymbol} options={stockOptions} onChange={setStockSymbol} showSearch={false} disabled={loadingStocks} />
            </div>
            <div className="add-stock-footer">
              <label>Quantity (Step 4)</label>
              <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Enter quantity" />
              <label>Add Stock (Step 5)</label>
              <button type="button" className="btn dashboard-add-btn" onClick={addStock}>Add To Portfolio</button>
            </div>
          </div>
          <PortfolioTable rows={portfolioRows} onEdit={editRow} onRemove={removeRow} />
          <div className="chart-grid">
            <ChartCard title="Profit and Loss"><Bar data={{ labels: chartLabels, datasets: [{ label: "Profit/Loss", data: profitLossData, backgroundColor: "#3b82f6" }] }} options={chartOptions} /></ChartCard>
            <ChartCard title="Discount Percentage"><Bar data={{ labels: chartLabels, datasets: [{ label: "Discount %", data: discountData, backgroundColor: "#22c55e" }] }} options={chartOptions} /></ChartCard>
            <ChartCard title="Opportunity Value"><Bar data={{ labels: chartLabels, datasets: [{ label: "Opportunity", data: opportunityData, backgroundColor: "#f59e0b" }] }} options={chartOptions} /></ChartCard>
            <ChartCard title="P/E Ratio"><Bar data={{ labels: chartLabels, datasets: [{ label: "P/E Ratio", data: peData, backgroundColor: "#a855f7" }] }} options={chartOptions} /></ChartCard>
          </div>
        </main>
      </div>
    </div>
  );
}

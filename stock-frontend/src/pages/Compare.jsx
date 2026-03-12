import { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import SearchableSelect from "../components/SearchableSelect";
import ChartCard from "../components/ChartCard";
import { registerCharts } from "../charts/registerCharts";
import api from "../api/axios";
registerCharts();
export default function Compare() {
  const [stocks, setStocks] = useState([]);
  const [leftStock, setLeftStock] = useState("");
  const [rightStock, setRightStock] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get("/portfolio/");
        const items = res.data?.stocks || [];
        const loaded = items.map((item) => ({
          symbol: item.stock?.symbol || "",
          company: item.stock?.company_name || item.stock?.symbol || "",
          price: Number(item.stock?.price || 0),
          peRatio: Number(item.stock?.pe_ratio || 0),
        })).filter((s) => s.symbol);
        setStocks(loaded);
        if (loaded.length > 0) setLeftStock(loaded[0].symbol);
        if (loaded.length > 1) setRightStock(loaded[1].symbol);
      } catch { }
    };
    run();
  }, []);
const options = stocks.map((s) => ({ value: s.symbol, label: `${s.symbol} - ${s.company}` }));
  const left = useMemo(() => stocks.find((s) => s.symbol === leftStock) || { symbol: "", price: 0, peRatio: 0 }, [stocks, leftStock]);
  const right = useMemo(() => stocks.find((s) => s.symbol === rightStock) || { symbol: "", price: 0, peRatio: 0 }, [stocks, rightStock]);
  const trendLabels = ["Q1", "Q2", "Q3", "Q4"];
  const leftTrend = [left.price * 0.9, left.price * 0.95, left.price * 0.98, left.price];
  const rightTrend = [right.price * 0.9, right.price * 0.93, right.price * 0.97, right.price];
  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <h2 className="page-title">Compare Stocks</h2>
          <div className="builder-grid">
            <SearchableSelect label="Stock A" value={leftStock} options={options} onChange={setLeftStock} />
            <SearchableSelect label="Stock B" value={rightStock} options={options} onChange={setRightStock} />
          </div>
          <div className="chart-grid">
            <ChartCard title="Price Comparison">
              <Bar data={{ labels: [left.symbol, right.symbol], datasets: [{ label: "Current Price", data: [left.price, right.price], backgroundColor: ["#60a5fa", "#f59e0b"] }] }} options={{ responsive: true, maintainAspectRatio: false }} />
            </ChartCard>
            <ChartCard title="Performance Comparison">
              <Line data={{ labels: trendLabels, datasets: [{ label: left.symbol, data: leftTrend, borderColor: "#60a5fa", tension: 0.3 }, { label: right.symbol, data: rightTrend, borderColor: "#22c55e", tension: 0.3 }] }} options={{ responsive: true, maintainAspectRatio: false }} />
            </ChartCard>
            <ChartCard title="P/E Ratio Comparison">
              <Bar data={{ labels: [left.symbol, right.symbol], datasets: [{ label: "P/E Ratio", data: [left.peRatio, right.peRatio], backgroundColor: ["#a855f7", "#f43f5e"] }] }} options={{ responsive: true, maintainAspectRatio: false }} />
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  );
}

import { Line, Bar } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChartCard from "../components/ChartCard";
import StatCard from "../components/StatCard";
import { registerCharts } from "../charts/registerCharts";
import { bitcoinPrices } from "../data/mockData";

registerCharts();

export default function Bitcoin() {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const marketTrend = bitcoinPrices[bitcoinPrices.length - 1] >= bitcoinPrices[0] ? "UP" : "DOWN";
  const avg = bitcoinPrices.reduce((sum, value) => sum + value, 0) / bitcoinPrices.length;

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <h2 className="page-title">Bitcoin Analysis</h2>
          <div className="stats-grid">
            <StatCard label="Market Trend" value={marketTrend} />
            <StatCard label="Average Price" value={avg.toFixed(2)} />
            <StatCard label="Current Price" value={bitcoinPrices[bitcoinPrices.length - 1].toFixed(2)} />
          </div>
          <ChartCard title="Bitcoin Price Chart">
            <Line
              data={{
                labels,
                datasets: [{ label: "BTC Price", data: bitcoinPrices, borderColor: "#f97316", tension: 0.25 }],
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </ChartCard>
          <ChartCard title="Market Trend Visualization">
            <Bar
              data={{
                labels,
                datasets: [{ label: "Price Range", data: bitcoinPrices, backgroundColor: "#3b82f6" }],
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </ChartCard>
        </main>
      </div>
    </div>
  );
}

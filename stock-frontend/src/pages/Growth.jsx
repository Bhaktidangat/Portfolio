import { Line, Pie } from "react-chartjs-2";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChartCard from "../components/ChartCard";
import StatCard from "../components/StatCard";
import { registerCharts } from "../charts/registerCharts";
import { growthSeries, sectorAllocation } from "../data/mockData";

registerCharts();

export default function Growth() {
  const labels = growthSeries.map((row) => row.month);
  const actual = growthSeries.map((row) => row.actual);
  const predicted = growthSeries.map((row) => row.predicted);

  const totalValue = actual[actual.length - 1];
  const futureValue = predicted[predicted.length - 1];
  const minValue = Math.min(...actual);
  const maxValue = Math.max(...actual);
  const profitLoss = totalValue - actual[0];

  return (
    <div className="page">
      <Navbar />
      <div className="app-grid">
        <Sidebar />
        <main>
          <div className="card">
            <h2>Portfolio Growth</h2>
            <div className="stats-grid">
              <StatCard label="Total Portfolio Value" value={totalValue.toLocaleString()} />
              <StatCard label="Profit and Loss" value={profitLoss.toLocaleString()} />
              <StatCard label="Future Value" value={futureValue.toLocaleString()} />
              <StatCard label="Minimum Value" value={minValue.toLocaleString()} />
              <StatCard label="Maximum Value" value={maxValue.toLocaleString()} />
              <StatCard label="Average P/E Ratio" value="24.6" />
              <StatCard label="Best Performing Stock" value="MSFT" />
            </div>
          </div>

          <ChartCard title="Actual vs Predicted Portfolio Value">
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: "Actual Portfolio Value",
                    data: actual,
                    borderColor: "#60a5fa",
                    backgroundColor: "rgba(96,165,250,0.18)",
                    tension: 0.35,
                    fill: true,
                  },
                  {
                    label: "Predicted Future Value",
                    data: predicted,
                    borderColor: "#f59e0b",
                    backgroundColor: "rgba(245,158,11,0.14)",
                    tension: 0.35,
                    fill: true,
                  },
                ],
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </ChartCard>

          <ChartCard title="Sector Allocation">
            <Pie
              data={{
                labels: sectorAllocation.map((row) => row.sector),
                datasets: [
                  {
                    data: sectorAllocation.map((row) => row.value),
                    backgroundColor: ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7"],
                  },
                ],
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </ChartCard>
        </main>
      </div>
    </div>
  );
}

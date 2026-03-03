import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PerformanceCharts({ portfolioItems }) {
  if (!portfolioItems.length) {
    return <p>Add stocks to portfolio to view PE and Profit/Loss charts.</p>;
  }

  const labels = portfolioItems.map((item) => item.stock.symbol);
  const peValues = portfolioItems.map((item) => Number(item.pe_ratio || 0));
  const plValues = portfolioItems.map((item) => Number(item.profit_loss || 0));

  const peData = {
    labels,
    datasets: [
      {
        label: "PE Ratio",
        data: peValues,
        backgroundColor: "rgba(59, 130, 246, 0.65)",
        borderColor: "rgba(37, 99, 235, 1)",
        borderWidth: 1,
      },
    ],
  };

  const allProfitLossZero = plValues.every((value) => Math.abs(value) < 0.000001);

  const plData = {
    labels,
    datasets: [
      {
        label: "Profit/Loss ($)",
        data: plValues,
        backgroundColor: plValues.map((value) =>
          value >= 0 ? "rgba(16, 185, 129, 0.65)" : "rgba(239, 68, 68, 0.65)"
        ),
        borderColor: plValues.map((value) =>
          value >= 0 ? "rgba(5, 150, 105, 1)" : "rgba(220, 38, 38, 1)"
        ),
        borderWidth: 1,
        minBarLength: 4,
      },
    ],
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="analytics-grid">
      <div className="analytics-card">
        <h4>PE Ratio Comparison</h4>
        <div className="chart-box">
          <Bar data={peData} options={commonOptions} />
        </div>
      </div>
      <div className="analytics-card">
        <h4>Profit/Loss by Stock</h4>
        {allProfitLossZero && (
          <p className="chart-note">
            All positions are currently at breakeven (profit/loss = $0.00).
          </p>
        )}
        <div className="chart-box">
          <Bar
            data={plData}
            options={{
              ...commonOptions,
              scales: {
                y: {
                  beginAtZero: true,
                  suggestedMin: allProfitLossZero ? -1 : undefined,
                  suggestedMax: allProfitLossZero ? 1 : undefined,
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

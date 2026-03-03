import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function buildDummyHistory(price) {
  const p = Number(price) || 0;
  return [
    p * 0.95,
    p * 0.97,
    p * 0.96,
    p * 0.99,
    p * 1.01,
    p * 1.02,
    p,
  ].map((v) => Number(v.toFixed(2)));
}

export default function StockChart({ stocks }) {
  const [selectedStockId, setSelectedStockId] = useState("");

  const selectedStock = useMemo(
    () => stocks.find((s) => s.id === Number(selectedStockId)),
    [stocks, selectedStockId]
  );

  const chartData = useMemo(() => {
    const labels = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
    const values = selectedStock ? buildDummyHistory(selectedStock.price) : [];

    return {
      labels,
      datasets: [
        {
          label: selectedStock ? `${selectedStock.symbol} Price` : "Select a stock",
          data: values,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.3)",
          tension: 0.3,
        },
      ],
    };
  }, [selectedStock]);

  if (!stocks.length) {
    return <p>No stocks available to chart.</p>;
  }

  return (
    <div>
      <div className="form-row" style={{ marginBottom: 12 }}>
        <select
          value={selectedStockId}
          onChange={(e) => setSelectedStockId(e.target.value)}
        >
          <option value="">Select stock</option>
          {stocks.map((stock) => (
            <option key={stock.id} value={stock.id}>
              {stock.symbol} - {stock.company_name}
            </option>
          ))}
        </select>
      </div>
      <Line data={chartData} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StockTicker from "../components/StockTicker";
import { trendingStocks } from "../data/mockData";

function getUpdatedTickerRows(rows) {
  return rows.map((row) => {
    const drift = (Math.random() * 2 - 1) * 0.9;
    const nextPrice = Math.max(1, row.price * (1 + drift / 100));
    return {
      ...row,
      price: Number(nextPrice.toFixed(2)),
      change: Number((row.change + drift * 0.4).toFixed(2)),
    };
  });
}

export default function Home() {
  const [tickerRows, setTickerRows] = useState(trendingStocks);
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem("portfolio_user") === "true";
  const quickLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/growth", label: "Growth" },
    { to: "/ml-analysis", label: "ML Analysis" },
    { to: "/gold-silver", label: "Gold Silver" },
    { to: "/bitcoin", label: "Bitcoin" },
    { to: "/compare", label: "Compare" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setTickerRows((prev) => getUpdatedTickerRows(prev)), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="page">
      <Navbar />
      <main className="home-layout">
        <section className="home-left">
          <StockTicker rows={tickerRows} />
        </section>
        <section className="home-hero card">
          <h2>Build Your Own Portfolio</h2>
          <p>
            Track holdings, visualize portfolio metrics, and explore ML-based insights from one
            simple analytics workspace.
          </p>
          <div className="home-quick-links">
            {quickLinks.map((item) => (
              <button
                key={item.to}
                type="button"
                className="btn home-quick-link-btn"
                onClick={() => navigate(isLoggedIn ? item.to : "/login")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

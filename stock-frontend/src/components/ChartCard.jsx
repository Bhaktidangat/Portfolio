export default function ChartCard({ title, children, className = "", kicker = "" }) {
  const cardClassName = ["card", "chart-card", className].filter(Boolean).join(" ");
  return (
    <div className={cardClassName}>
      {kicker ? <p className="chart-kicker">{kicker}</p> : null}
      <h3>{title}</h3>
      <div className="chart-container">{children}</div>
    </div>
  );
}

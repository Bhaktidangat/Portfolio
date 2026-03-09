export default function ChartCard({ title, children }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      <div className="chart-container">{children}</div>
    </div>
  );
}

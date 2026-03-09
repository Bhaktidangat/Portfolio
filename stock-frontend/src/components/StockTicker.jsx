export default function StockTicker({ rows }) {
  return (
    <div className="card ticker-card">
      <h3>Top 10 Trending Stocks</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Price</th>
              <th>Change %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((stock) => (
              <tr key={stock.symbol}>
                <td>{stock.symbol}</td>
                <td>{stock.price.toFixed(2)}</td>
                <td className={stock.change >= 0 ? "profit-text" : "loss-text"}>
                  {stock.change >= 0 ? "+" : ""}
                  {stock.change.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

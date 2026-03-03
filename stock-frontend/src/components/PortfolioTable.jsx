export default function PortfolioTable({ portfolioItems, onRemove }) {
  if (!portfolioItems.length) {
    return <p>No stocks in portfolio yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Quantity</th>
            <th>Buy Price</th>
            <th>Current Price</th>
            <th>PE Ratio</th>
            <th>Discount</th>
            <th>Profit/Loss</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {portfolioItems.map((item) => (
            <tr key={item.id}>
              <td>{item.stock.symbol}</td>
              <td>{item.stock.company_name}</td>
              <td>{item.quantity}</td>
              <td>${Number(item.buy_price).toFixed(2)}</td>
              <td>${Number(item.current_price ?? item.stock.price).toFixed(2)}</td>
              <td>{item.pe_ratio ? Number(item.pe_ratio).toFixed(2) : "N/A"}</td>
              <td
                className={Number(item.discount) >= 0 ? "profit-text" : "loss-text"}
              >
                {Number(item.discount).toFixed(2)}%
              </td>
              <td
                className={Number(item.profit_loss) >= 0 ? "profit-text" : "loss-text"}
              >
                ${Number(item.profit_loss).toFixed(2)}
              </td>
              <td>
                <button
                  className="button-danger"
                  onClick={() => onRemove(item.stock.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

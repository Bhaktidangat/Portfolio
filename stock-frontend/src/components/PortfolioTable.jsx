export default function PortfolioTable({ rows, onEdit, onRemove }) {
  return (
    <div className="card">
      <h3>Portfolio Table</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th>Quantity</th>
              <th>Buy Price</th>
              <th>Current Price</th>
              <th>P/E Ratio</th>
              <th>Discount %</th>
              <th>Profit/Loss</th>
              <th>Position Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const profitLoss = (row.currentPrice - row.buyPrice) * row.quantity;
              const positionValue = row.currentPrice * row.quantity;
              return (
                <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td>{row.company}</td>
                  <td>{row.quantity}</td>
                  <td>{row.buyPrice.toFixed(2)}</td>
                  <td>{row.currentPrice.toFixed(2)}</td>
                  <td>{row.peRatio.toFixed(2)}</td>
                  <td>{row.discountPct.toFixed(2)}%</td>
                  <td className={profitLoss >= 0 ? "profit-text" : "loss-text"}>
                    {profitLoss.toFixed(2)}
                  </td>
                  <td>{positionValue.toFixed(2)}</td>
                  <td>
                    <div className="action-group">
                      <button type="button" className="btn btn-muted" onClick={() => onEdit(row.symbol)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => onRemove(row.symbol)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

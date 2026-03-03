import { useState } from "react";

export default function AddStockForm({ stocks, onAdd }) {
  const [stockId, setStockId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const selectedStock = stocks.find((stock) => stock.id === Number(stockId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stockId || quantity <= 0) return;
    await onAdd(Number(stockId), Number(quantity));
    setQuantity(1);
  };

  return (
    <form className="form-row" onSubmit={handleSubmit}>
      <select
        value={stockId}
        onChange={(e) => setStockId(e.target.value)}
        required
      >
        <option value="">Select stock</option>
        {stocks.map((stock) => (
          <option key={stock.id} value={stock.id}>
            {stock.symbol} - {stock.company_name}
          </option>
        ))}
      </select>

      <input
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
      />

      <div className="auto-buy-box">
        Buy Price:{" "}
        {selectedStock ? `$${Number(selectedStock.price).toFixed(2)}` : "Select stock"}
      </div>

      <button type="submit">Add Stock</button>
    </form>
  );
}

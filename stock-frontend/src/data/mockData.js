export const countries = [
  { value: "US", label: "United States", currency: "USD" },
  { value: "IN", label: "India", currency: "INR" },
  { value: "UK", label: "United Kingdom", currency: "GBP" },
];

export const sectors = [
  { value: "Technology", label: "Technology" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Finance", label: "Finance" },
  { value: "Energy", label: "Energy" },
];

export const stocks = [
  { symbol: "AAPL", company: "Apple Inc.", sector: "Technology", country: "US", price: 193.2, peRatio: 30.2, discountPct: 4.2 },
  { symbol: "MSFT", company: "Microsoft Corp.", sector: "Technology", country: "US", price: 416.8, peRatio: 34.5, discountPct: 3.5 },
  { symbol: "RELIANCE", company: "Reliance Industries", sector: "Energy", country: "IN", price: 2872.4, peRatio: 26.1, discountPct: 5.2 },
  { symbol: "HDFCBANK", company: "HDFC Bank", sector: "Finance", country: "IN", price: 1625.4, peRatio: 18.3, discountPct: 2.1 },
  { symbol: "AZN", company: "AstraZeneca", sector: "Healthcare", country: "UK", price: 123.6, peRatio: 29.4, discountPct: 3.2 },
  { symbol: "BP", company: "BP plc", sector: "Energy", country: "UK", price: 38.2, peRatio: 12.9, discountPct: 1.8 },
];

export const trendingStocks = [
  { symbol: "NVDA", price: 845.5, change: 1.8 },
  { symbol: "TSLA", price: 221.3, change: -0.9 },
  { symbol: "AMD", price: 180.2, change: 1.1 },
  { symbol: "AMZN", price: 177.6, change: 0.6 },
  { symbol: "GOOGL", price: 162.1, change: -0.4 },
  { symbol: "META", price: 501.3, change: 1.4 },
  { symbol: "NFLX", price: 615.8, change: 0.8 },
  { symbol: "JPM", price: 198.9, change: -0.2 },
  { symbol: "XOM", price: 111.2, change: 0.5 },
  { symbol: "BA", price: 184.4, change: -0.7 },
];

export const dashboardSeedPortfolio = [
  { symbol: "AAPL", company: "Apple Inc.", quantity: 8, buyPrice: 180.0, currentPrice: 193.2, peRatio: 30.2, discountPct: 4.2 },
  { symbol: "HDFCBANK", company: "HDFC Bank", quantity: 15, buyPrice: 1540.0, currentPrice: 1625.4, peRatio: 18.3, discountPct: 2.1 },
];

export const growthSeries = [
  { month: "Jan", actual: 18000, predicted: 18000 },
  { month: "Feb", actual: 18800, predicted: 19000 },
  { month: "Mar", actual: 19300, predicted: 19700 },
  { month: "Apr", actual: 20100, predicted: 20600 },
  { month: "May", actual: 20900, predicted: 21400 },
  { month: "Jun", actual: 21600, predicted: 22400 },
];

export const sectorAllocation = [
  { sector: "Technology", value: 45 },
  { sector: "Finance", value: 25 },
  { sector: "Energy", value: 18 },
  { sector: "Healthcare", value: 12 },
];

export const mlTableRows = [
  { symbol: "AAPL", cluster: "C1", actualTotal: 1545, actualFuture: 1601, predictedFuture: 1624 },
  { symbol: "MSFT", cluster: "C2", actualTotal: 2084, actualFuture: 2140, predictedFuture: 2178 },
  { symbol: "RELIANCE", cluster: "C3", actualTotal: 1422, actualFuture: 1488, predictedFuture: 1519 },
  { symbol: "HDFCBANK", cluster: "C2", actualTotal: 1768, actualFuture: 1829, predictedFuture: 1861 },
  { symbol: "AZN", cluster: "C1", actualTotal: 1032, actualFuture: 1069, predictedFuture: 1072 },
  { symbol: "BP", cluster: "C3", actualTotal: 842, actualFuture: 854, predictedFuture: 862 },
  { symbol: "NVDA", cluster: "C1", actualTotal: 2334, actualFuture: 2421, predictedFuture: 2498 },
  { symbol: "TSLA", cluster: "C2", actualTotal: 1198, actualFuture: 1240, predictedFuture: 1274 },
  { symbol: "AMD", cluster: "C1", actualTotal: 1294, actualFuture: 1341, predictedFuture: 1376 },
  { symbol: "GOOGL", cluster: "C2", actualTotal: 1640, actualFuture: 1706, predictedFuture: 1749 },
];

export const mlPredictions = {
  AAPL: [100, 106, 113, 119, 124, 129],
  MSFT: [120, 129, 137, 145, 152, 160],
  RELIANCE: [92, 96, 101, 107, 112, 118],
  HDFCBANK: [88, 91, 95, 99, 103, 108],
  AZN: [95, 98, 101, 104, 106, 109],
  BP: [80, 82, 84, 85, 86, 88],
  NVDA: [130, 138, 147, 156, 165, 174],
  TSLA: [97, 102, 108, 115, 121, 128],
  AMD: [90, 95, 101, 106, 112, 118],
  GOOGL: [102, 107, 113, 118, 124, 130],
};

export const goldPrices = [1920, 1935, 1948, 1952, 1960, 1974, 1982];
export const silverPrices = [24.4, 24.8, 25.1, 24.9, 25.3, 25.6, 25.9];
export const bitcoinPrices = [40200, 41300, 42500, 43900, 45100, 44700, 46200];

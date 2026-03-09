import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  BarElement,
} from "chart.js";

let registered = false;

export function registerCharts() {
  if (registered) return;

  ChartJS.register(
    ArcElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );

  ChartJS.defaults.color = "#c7d3ea";
  ChartJS.defaults.borderColor = "rgba(125, 151, 198, 0.22)";
  ChartJS.defaults.plugins.legend.labels.color = "#d7e2f7";
  ChartJS.defaults.plugins.tooltip.backgroundColor = "rgba(9, 16, 31, 0.95)";
  ChartJS.defaults.plugins.tooltip.titleColor = "#eef4ff";
  ChartJS.defaults.plugins.tooltip.bodyColor = "#d7e2f7";
  registered = true;
}

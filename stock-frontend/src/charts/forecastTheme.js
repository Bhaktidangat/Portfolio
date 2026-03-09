export const forecastAreaPlugin = {
  id: "forecastAreaBackground",
  beforeDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const { left, top, right, bottom } = chartArea;
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, "rgba(16, 57, 96, 0.34)");
    gradient.addColorStop(1, "rgba(5, 17, 40, 0.12)");
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.restore();
  },
};

export function getForecastChartOptions({ maxTicksLimit = 10 } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    layout: { padding: { top: 8, right: 12, bottom: 4, left: 6 } },
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "#d3e7ff",
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(10, 19, 40, 0.95)",
        borderColor: "rgba(96, 165, 250, 0.35)",
        borderWidth: 1,
        titleColor: "#e9f2ff",
        bodyColor: "#d4e5ff",
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(132, 165, 214, 0.14)", drawBorder: false },
        ticks: {
          color: "#adc6e8",
          autoSkip: true,
          maxTicksLimit,
          maxRotation: 38,
          minRotation: 0,
        },
      },
      y: {
        grid: { color: "rgba(132, 165, 214, 0.14)", drawBorder: false },
        ticks: { color: "#adc6e8" },
      },
    },
    elements: {
      point: {
        radius: 2,
        hoverRadius: 4,
      },
      line: {
        borderWidth: 2.5,
      },
    },
  };
}

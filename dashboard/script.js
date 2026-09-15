const API_HOST = "https://acer-server.tail1f6c3f.ts.net";
const STALE_MINUTES = 10;
const POLL_INTERVAL_MS = 30000;

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const aboutDialog = document.getElementById("aboutDialog");
document.getElementById("aboutBtn").addEventListener("click", () => aboutDialog.showModal());
document.getElementById("closeDialog").addEventListener("click", () => aboutDialog.close());
aboutDialog.addEventListener("click", (e) => {
  const rect = aboutDialog.getBoundingClientRect();
  const clickedInside =
    e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!clickedInside) aboutDialog.close();
});

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesAgo(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "&mdash;";
  return `${Math.round(value)}<span class="unit">%</span>`;
}

function formatTemp(value) {
  if (!Number.isFinite(value)) return "&mdash;";
  return `${Math.round(value)}<span class="unit">&deg;C</span>`;
}

function clearReadouts() {
  ["valCpu", "valRam", "valDisk", "valTemp"].forEach(id => {
    document.getElementById(id).innerHTML = "&mdash;";
  });
}

async function loadStatus() {
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusLabel");
  const sub = document.getElementById("statusSub");

  try {
    const res = await fetch(`${API_HOST}/api/status`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();

    if (!data.online) {
      dot.className = "dot bad";
      label.textContent = "No data yet";
      sub.textContent = "The collector hasn't reported anything.";
      clearReadouts();
      return;
    }

    const age = minutesAgo(data.timestamp);
    const stale = age > STALE_MINUTES;

    dot.className = "dot " + (stale ? "bad" : "good");
    label.textContent = stale ? "Not responding" : "Online";
    sub.textContent = stale
      ? `Last seen ${age} min ago (${fmtTime(data.timestamp)})`
      : `Last checked at ${fmtTime(data.timestamp)}`;

    document.getElementById("valCpu").innerHTML = formatPercent(data.cpu_percent);
    document.getElementById("valRam").innerHTML = formatPercent(data.ram_percent);
    document.getElementById("valDisk").innerHTML = formatPercent(data.disk_percent);
    document.getElementById("valTemp").innerHTML = formatTemp(data.temp_celsius);
  } catch (e) {
    dot.className = "dot bad";
    label.textContent = "Unreachable";
    sub.textContent = "Couldn't reach the API right now.";
    clearReadouts();
  }
}

const uptimeTooltip = document.createElement("div");
uptimeTooltip.className = "bar-tooltip";
document.body.appendChild(uptimeTooltip);

function uptimeStatusWord(p) {
  if (p >= 95) return "Fully up";
  if (p >= 50) return "Partial outage";
  if (p > 0) return "Mostly down";
  return "No data";
}

function formatDay(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function showUptimeTooltip(bar, d) {
  uptimeTooltip.innerHTML = `
    <strong>${formatDay(d.date)}</strong>
    <span>${uptimeStatusWord(d.uptime_percent)} &middot; ${d.uptime_percent}%</span>
  `;
  uptimeTooltip.style.display = "block";

  const rect = bar.getBoundingClientRect();
  const tipRect = uptimeTooltip.getBoundingClientRect();
  uptimeTooltip.style.left = `${rect.left + rect.width / 2 - tipRect.width / 2}px`;
  uptimeTooltip.style.top = `${rect.top - tipRect.height - 8}px`;
}

function hideUptimeTooltip() {
  uptimeTooltip.style.display = "none";
}

async function loadUptime() {
  const row = document.getElementById("uptimeRow");
  try {
    const res = await fetch(`${API_HOST}/api/uptime?days=30`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const days = await res.json();

    row.innerHTML = "";
    days.forEach(d => {
      const bar = document.createElement("div");
      bar.className = "uptime-bar";
      bar.setAttribute("role", "img");
      const p = d.uptime_percent;
      let color = "var(--border-light)";
      if (p >= 95) color = "var(--good)";
      else if (p >= 50) color = "var(--warn)";
      else if (p > 0) color = "var(--bad)";
      bar.style.background = color;
      bar.setAttribute("aria-label", `${d.date}: ${uptimeStatusWord(p)}, ${p}% uptime`);
      bar.addEventListener("mouseenter", () => showUptimeTooltip(bar, d));
      bar.addEventListener("mouseleave", hideUptimeTooltip);
      row.appendChild(bar);
    });

    document.getElementById("uptimeFrom").textContent = days[0]?.date || "";

    // Today is a partial day (compared against a smaller expected sample count),
    // so it's excluded here to avoid skewing the average of full, completed days.
    const completedDays = days.length > 1 ? days.slice(0, -1) : days;
    const avgText = completedDays.length
      ? `${Math.round(completedDays.reduce((sum, d) => sum + d.uptime_percent, 0) / completedDays.length)}% avg`
      : "";
    document.getElementById("uptimeAvg").textContent = avgText;
  } catch (e) {
    row.innerHTML = '<div class="error">Couldn\'t load uptime data.</div>';
  }
}

// Shared visual style for all three line charts
function baseChartConfig(color, fixedScale) {
  const unit = fixedScale ? "%" : "\u00b0C";

  return {
    type: "line",
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 4.5,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cssVar("--border"),
          borderColor: cssVar("--border-light"),
          borderWidth: 1,
          titleColor: cssVar("--heading"),
          bodyColor: cssVar("--text-muted"),
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          titleFont: { size: 12, weight: "600" },
          bodyFont: { size: 12 },
          callbacks: {
            label: (context) => `${context.formattedValue}${unit}`,
          },
        },
      },
      elements: {
        point: { radius: 0 },
        line: { borderColor: color, borderWidth: 1.5, tension: 0.3 },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#8b949e", maxTicksLimit: 6, font: { size: 11 } },
        },
        y: {
          min: fixedScale ? 0 : undefined,
          max: fixedScale ? 100 : undefined,
          grid: { display: false },
          border: { display: false },
          ticks: { count: 2, color: "#8b949e", font: { size: 11 } },
        },
      },
    },
  };
}

const charts = {};

function renderChart(canvasId, color, labels, values, fixedScale) {
  if (charts[canvasId]) {
    charts[canvasId].data.labels = labels;
    charts[canvasId].data.datasets[0].data = values;
    charts[canvasId].update();
    return;
  }

  const ctx = document.getElementById(canvasId);
  const config = baseChartConfig(color, fixedScale);
  config.data = {
    labels,
    datasets: [{
      data: values,
      fill: true,
      backgroundColor: (context) => {
        const { ctx: c, chartArea } = context.chart;
        if (!chartArea) return null;
        const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, color + "40");
        gradient.addColorStop(1, color + "00");
        return gradient;
      },
    }],
  };
  charts[canvasId] = new Chart(ctx, config);
}

// Clears every chart's data without removing the canvas from the DOM,
// so the same element (and its id) is still there once real data comes back
function clearAllCharts() {
  Object.values(charts).forEach(chart => {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
  });
}

async function loadHistory() {
  const emptyNote = document.getElementById("historyEmpty");

  try {
    const res = await fetch(`${API_HOST}/api/history?hours=24`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const points = await res.json();

    if (!points.length) {
      emptyNote.textContent = "No readings in this window.";
      emptyNote.hidden = false;
      clearAllCharts();
      return;
    }

    emptyNote.hidden = true;
    const labels = points.map(p => fmtTime(p.timestamp));
    renderChart("chartTemp", cssVar("--warn"), labels, points.map(p => p.temp_celsius), false);
    renderChart("chartCpu", cssVar("--blue"), labels, points.map(p => p.cpu_percent), true);
    renderChart("chartRam", cssVar("--purple"), labels, points.map(p => p.ram_percent), true);
  } catch (e) {
    console.error(e);
    // Keep whatever the charts were already showing; just flag that this refresh failed
    emptyNote.textContent = "Couldn't refresh the charts.";
    emptyNote.hidden = false;
  }
}

let loading = false;

async function loadAll() {
  if (loading) return;
  loading = true;
  try {
    await Promise.all([loadStatus(), loadUptime(), loadHistory()]);
  } finally {
    loading = false;
  }
}

loadAll();
setInterval(loadAll, POLL_INTERVAL_MS);
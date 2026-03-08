(function () {
  const SHEET_ID =
    window.SMART_TEA_GARDEN_RT_SHEET_ID ||
    window.DASHBOARD_SHEET_ID ||
    "REPLACE_WITH_REALTIME_SHEET_ID";
  const SHEET_NAME = window.DASHBOARD_SHEET_NAME || "Smart Tea Garden rt";
  const INTERVAL = window.DASHBOARD_POLL_INTERVAL || 60_000;

  function buildUrl() {
    if (!SHEET_ID || SHEET_ID.startsWith("REPLACE")) {
      throw new Error("Dashboard sheet ID is not configured.");
    }
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      SHEET_NAME
    )}&t=${Date.now()}`;
  }

  async function fetchRows() {
    const url = buildUrl();
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Google Sheets responded ${resp.status}`);
    }
    const text = await resp.text();
    const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const payload = JSON.parse(jsonText);
    const headers = payload.table.cols.map((col) => col.label || col.id);
    const rows = payload.table.rows
      .filter((row) => row.c)
      .map((row) => {
        const obj = {};
        row.c.forEach((cell, idx) => {
          obj[headers[idx] || `col${idx}`] = cell ? cell.v : "";
        });
        return obj;
      });
    return rows;
  }

  function formatNumber(value, digits = 1) {
    if (value === undefined || value === null || value === "") return "--";
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return Number(num).toFixed(digits);
  }

  function groupByStation(rows) {
    const map = {};
    rows.forEach((row) => {
      const key = row["Station ID"];
      if (!key) return;
      map[key] = row;
    });
    return map;
  }

  function latest(rows) {
    return rows.length ? rows[rows.length - 1] : null;
  }

  function startPolling({ render, onError, interval = INTERVAL }) {
    async function tick() {
      try {
        const rows = await fetchRows();
        render(rows);
      } catch (err) {
        console.error(err);
        if (onError) onError(err);
      }
    }
    tick();
    return setInterval(tick, interval);
  }

  window.dashboardData = {
    startPolling,
    formatNumber,
    groupByStation,
    latest,
  };
})();

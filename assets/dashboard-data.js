(function () {
  const DEFAULT_URL = "data.json";
  const POLL_INTERVAL = window.DASHBOARD_POLL_INTERVAL || 60_000;

  async function fetchData() {
    const url = (window.DASHBOARD_DATA_URL || DEFAULT_URL) + `?t=${Date.now()}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to load ${url}: ${resp.status}`);
    }
    return await resp.json();
  }

  function formatNumber(value, digits = 1) {
    if (value === undefined || value === null || value === "") return "--";
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return Number(num).toFixed(digits);
  }

  function station(data, number) {
    if (!data || !data.sensors) return null;
    return data.sensors[`Station${number}`] || null;
  }

  function startPolling({ render, onError, interval = POLL_INTERVAL }) {
    async function tick() {
      try {
        const data = await fetchData();
        render(data || {});
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
    station,
  };
})();

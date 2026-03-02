window.FunShared = (() => {
  const refreshState = new Map();

  async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  function formatLiters(value) {
    return `${Number(value || 0).toFixed(2)} L`;
  }

  function formatPace(value) {
    return `${Number(value || 0).toFixed(2)} L/h`;
  }

  function formatPercent(value) {
    const number = Number(value || 0);
    return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
  }

  function formatDateTime(value) {
    if (!value) {
      return "aucune trace";
    }
    return new Date(value).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatTime(value) {
    if (!value) {
      return "jamais";
    }
    return new Date(value).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getQueryUserId() {
    const raw = new URLSearchParams(window.location.search).get("userId");
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  function scheduleRefresh(key, refresh, minIntervalMs) {
    const state = refreshState.get(key) || {
      inFlight: null,
      lastRunAt: 0,
    };

    const now = Date.now();
    if (state.inFlight) {
      return state.inFlight;
    }

    if (now - state.lastRunAt < minIntervalMs) {
      return Promise.resolve();
    }

    state.inFlight = Promise.resolve()
      .then(() => refresh())
      .finally(() => {
        state.lastRunAt = Date.now();
        state.inFlight = null;
      });

    refreshState.set(key, state);
    return state.inFlight;
  }

  function connectScoreStream(key, refresh, minIntervalMs) {
    const source = new EventSource("/api/stats/stream");
    source.addEventListener("score-update", () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      scheduleRefresh(key, refresh, minIntervalMs).catch((error) =>
        console.error("refresh", error)
      );
    });
    source.onerror = () => {
      source.close();
      setTimeout(() => connectScoreStream(key, refresh, minIntervalMs), 5000);
    };
    return source;
  }

  function startAutoRefresh(
    key,
    refresh,
    {
      intervalMs = 15000,
      minIntervalMs = intervalMs,
      useStream = true,
      refreshWhenHidden = false,
    } = {}
  ) {
    const guardedRefresh = () => {
      if (!refreshWhenHidden && document.visibilityState === "hidden") {
        return Promise.resolve();
      }

      return scheduleRefresh(key, refresh, minIntervalMs);
    };

    guardedRefresh().catch((error) => console.error("refresh", error));
    if (useStream) {
      connectScoreStream(key, refresh, minIntervalMs);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        guardedRefresh().catch((error) => console.error("refresh", error));
      }
    });

    setInterval(() => {
      guardedRefresh().catch((error) => console.error("refresh", error));
    }, intervalMs);
  }

  function setMeta(id, text) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = text;
    }
  }

  return {
    fetchJSON,
    formatLiters,
    formatPace,
    formatPercent,
    formatDateTime,
    formatTime,
    getQueryUserId,
    connectScoreStream,
    scheduleRefresh,
    startAutoRefresh,
    setMeta,
  };
})();

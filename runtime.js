(() => {
  const keyFor = {
    Gmail: "gmail",
    "Google Calendar": "calendar",
    "Google Drive": "drive",
    "News/Web": "news",
    Markets: "markets"
  };

  let lastStatus = null;

  const applyStatus = () => {
    if (!lastStatus) return;
    const connectors = lastStatus.connectors || {};

    document.querySelectorAll(".connectorCard").forEach((card) => {
      const name = card.querySelector("h3")?.textContent?.trim();
      const key = keyFor[name];
      if (!key) return;
      const connected = Boolean(connectors[key]);
      const badge = card.querySelector(".pill");
      if (!badge) return;
      badge.className = `pill ${connected ? "ok" : "med"}`;
      badge.innerHTML = `<span class="statusdot ${connected ? "on" : "off"}"></span>${connected ? "מחובר" : "לא מחובר"}`;
    });

    const sidebarStatus = document.querySelector(".connector span");
    if (sidebarStatus && lastStatus.mode !== "demo") {
      const count = Object.values(connectors).filter(Boolean).length;
      sidebarStatus.style.color = "var(--green)";
      sidebarStatus.textContent = `● ${count} Connectors פעילים`;
    }
  };

  const loadStatus = async () => {
    try {
      const response = await fetch("/api/connectors", {
        headers: { accept: "application/json" }
      });
      if (!response.ok) return;
      lastStatus = await response.json();
      window.IH_CONNECTOR_STATUS = lastStatus;
      applyStatus();
    } catch {
      // Static preview: stay safely in Demo Mode.
    }
  };

  window.addEventListener("hashchange", () => setTimeout(applyStatus, 50));
  setTimeout(loadStatus, 250);
})();

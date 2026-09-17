(() => {
  const keyFor = {
    Gmail: "gmail",
    "Google Calendar": "calendar",
    "Google Drive": "drive",
    "News/Web": "news",
    Markets: "markets"
  };

  let lastStatus = null;
  let lastNews = null;

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

  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
      return null;
    }
  };

  const applyLiveNews = () => {
    if (!lastNews?.articles?.length) return;
    const page = document.getElementById("p-news");
    if (!page) return;

    page.querySelector("#liveNewsBlock")?.remove();

    const block = document.createElement("div");
    block.id = "liveNewsBlock";

    const section = document.createElement("div");
    section.className = "section";
    const title = document.createElement("h2");
    title.textContent = "Live News";
    const meta = document.createElement("small");
    meta.textContent = `GDELT · ${lastNews.count ?? lastNews.articles.length} results`;
    section.append(title, meta);

    const list = document.createElement("div");
    list.className = "card list";

    lastNews.articles.slice(0, 8).forEach((article) => {
      const row = document.createElement("div");
      row.className = "row change";

      const source = document.createElement("span");
      source.className = "tag";
      source.textContent = article.domain || "News";

      const content = document.createElement("div");
      const heading = document.createElement("b");
      heading.textContent = article.title || "Untitled";
      const detail = document.createElement("p");
      detail.textContent = `Live source · relevance ${article.relevance ?? 0} · ${article.sourceCountry || "global"}`;
      content.append(heading, detail);

      const url = safeUrl(article.url);
      const action = url ? document.createElement("a") : document.createElement("span");
      action.className = "btn";
      action.textContent = url ? "מקור" : "Live";
      if (url) {
        action.href = url;
        action.target = "_blank";
        action.rel = "noopener noreferrer";
      }

      row.append(source, content, action);
      list.append(row);
    });

    block.append(section, list);
    page.querySelector(".head")?.after(block);
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

  const loadNews = async () => {
    try {
      const response = await fetch("/api/news", {
        headers: { accept: "application/json" }
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload?.ok) return;
      lastNews = payload;
      window.IH_LIVE_NEWS = payload;
      applyLiveNews();
    } catch {
      // Static preview: keep seeded intelligence cards.
    }
  };

  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      applyStatus();
      applyLiveNews();
    }, 50);
  });

  setTimeout(() => {
    loadStatus();
    loadNews();
  }, 250);
})();

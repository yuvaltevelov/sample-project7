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
  let lastGmail = null;
  let lastCalendar = null;

  const safeUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
      return null;
    }
  };

  const statusLabel = (connected, available) => connected ? "מחובר" : available ? "מוכן לחיבור" : "לא מוגדר";

  const disconnectGoogle = async () => {
    try {
      const response = await fetch("/api/google/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("disconnect failed");
      lastGmail = null;
      lastCalendar = null;
      window.IH_LIVE_GMAIL = null;
      window.IH_LIVE_CALENDAR = null;
      await loadStatus();
      applyLiveGmail();
      applyLiveCalendar();
      if (window.toast) window.toast("Google נותק מה-Hub");
    } catch {
      if (window.toast) window.toast("לא הצלחתי לנתק את Google");
    }
  };

  const applyStatus = () => {
    if (!lastStatus) return;
    const connectors = lastStatus.connectors || {};
    const available = lastStatus.available || {};

    document.querySelectorAll(".connectorCard").forEach((card) => {
      const name = card.querySelector("h3")?.textContent?.trim();
      const key = keyFor[name];
      if (!key) return;
      const connected = Boolean(connectors[key]);
      const canConnect = Boolean(available[key]);
      const badge = card.querySelector(".pill");
      if (badge) {
        badge.className = `pill ${connected ? "ok" : "med"}`;
        badge.replaceChildren();
        const dot = document.createElement("span");
        dot.className = `statusdot ${connected ? "on" : "off"}`;
        badge.append(dot, document.createTextNode(statusLabel(connected, canConnect)));
      }

      const button = card.querySelector("button.btn");
      if (!button) return;

      if (key === "gmail" || key === "calendar") {
        if (connected) {
          button.textContent = "נתק Google";
          button.onclick = disconnectGoogle;
        } else if (canConnect) {
          button.textContent = "חבר Google";
          button.onclick = () => window.location.assign("/api/google/start");
        }
      }
    });

    const sidebarStatus = document.querySelector(".connector span");
    if (sidebarStatus && lastStatus.mode !== "demo") {
      const count = Object.values(connectors).filter(Boolean).length;
      sidebarStatus.style.color = "var(--green)";
      sidebarStatus.textContent = `● ${count} Connectors פעילים`;
    }
  };

  const applyLiveNews = () => {
    const page = document.getElementById("p-news");
    if (!page) return;
    page.querySelector("#liveNewsBlock")?.remove();
    if (!lastNews?.articles?.length) return;

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

  const applyLiveGmail = () => {
    const page = document.getElementById("p-inbox");
    if (!page) return;
    page.querySelector("#liveGmailBlock")?.remove();
    if (!lastStatus?.connectors?.gmail || !lastGmail) return;

    const block = document.createElement("div");
    block.id = "liveGmailBlock";
    const section = document.createElement("div");
    section.className = "section";
    const title = document.createElement("h2");
    title.textContent = "Live Gmail";
    const meta = document.createElement("small");
    meta.textContent = `${lastGmail.count ?? 0} relevant · last ${lastGmail.days ?? 7} days`;
    section.append(title, meta);

    const list = document.createElement("div");
    list.className = "card list";
    const messages = lastGmail.messages || [];
    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "אין כרגע מיילים חדשים שעברו את פילטר החשיבות.";
      list.append(empty);
    } else {
      messages.slice(0, 15).forEach((message) => {
        const row = document.createElement("div");
        row.className = "row email";
        const icon = document.createElement("div");
        icon.className = "mailIcon";
        icon.textContent = "✉";
        const content = document.createElement("div");
        const sender = document.createElement("b");
        sender.textContent = message.from || "Gmail";
        const subject = document.createElement("div");
        subject.style.fontSize = "10px";
        subject.style.marginTop = "2px";
        subject.textContent = message.subject || "(ללא נושא)";
        const detail = document.createElement("p");
        detail.textContent = `${message.why || ""}${message.snippet ? ` · ${message.snippet}` : ""}`;
        const actions = document.createElement("div");
        actions.className = "actions";
        if (message.id) {
          const link = document.createElement("a");
          link.className = "btn";
          link.textContent = "פתח ב-Gmail";
          link.href = `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.id)}`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          actions.append(link);
        }
        content.append(sender, subject, detail, actions);
        const right = document.createElement("div");
        right.className = "meta";
        const badge = document.createElement("span");
        badge.className = `pill ${message.priority === "critical" ? "high" : message.priority === "high" ? "med" : "ok"}`;
        badge.textContent = message.category || message.priority || "Live";
        right.append(badge);
        row.append(icon, content, right);
        list.append(row);
      });
    }
    block.append(section, list);
    page.querySelector(".filters")?.before(block);
  };

  const calendarStartText = (event) => {
    const value = event?.start?.dateTime || event?.start?.date;
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: event?.start?.dateTime ? "short" : undefined }).format(date);
  };

  const applyLiveCalendar = () => {
    const page = document.getElementById("p-calendar");
    if (!page) return;
    page.querySelector("#liveCalendarBlock")?.remove();
    if (!lastStatus?.connectors?.calendar || !lastCalendar) return;

    const block = document.createElement("div");
    block.id = "liveCalendarBlock";
    const section = document.createElement("div");
    section.className = "section";
    const title = document.createElement("h2");
    title.textContent = "Live Google Calendar";
    const meta = document.createElement("small");
    meta.textContent = `${lastCalendar.events?.length ?? 0} events · next ${lastCalendar.days ?? 14} days`;
    section.append(title, meta);

    const list = document.createElement("div");
    list.className = "card list";
    (lastCalendar.events || []).slice(0, 20).forEach((event) => {
      const row = document.createElement("div");
      row.className = "row change";
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = event.intelligenceHub ? "IH" : "Calendar";
      const content = document.createElement("div");
      const heading = document.createElement("b");
      heading.textContent = event.title || "(ללא כותרת)";
      const detail = document.createElement("p");
      detail.textContent = `${calendarStartText(event)}${event.source ? ` · ${event.source}` : ""}`;
      content.append(heading, detail);
      const linkUrl = safeUrl(event.htmlLink);
      const action = linkUrl ? document.createElement("a") : document.createElement("span");
      action.className = "btn";
      action.textContent = linkUrl ? "פתח" : "Event";
      if (linkUrl) {
        action.href = linkUrl;
        action.target = "_blank";
        action.rel = "noopener noreferrer";
      }
      row.append(tag, content, action);
      list.append(row);
    });
    block.append(section, list);
    page.querySelector(".banner")?.after(block);
  };

  const loadStatus = async () => {
    try {
      const response = await fetch("/api/connectors", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      lastStatus = await response.json();
      window.IH_CONNECTOR_STATUS = lastStatus;
      applyStatus();
      if (lastStatus.connectors?.gmail) loadGmail();
      if (lastStatus.connectors?.calendar) loadCalendar();
    } catch {
      // Static preview: stay safely in Demo Mode.
    }
  };

  const loadNews = async () => {
    try {
      const response = await fetch("/api/news", { headers: { accept: "application/json" } });
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

  const loadGmail = async () => {
    try {
      const response = await fetch("/api/gmail?days=7", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload?.ok) return;
      lastGmail = payload;
      window.IH_LIVE_GMAIL = payload;
      applyLiveGmail();
    } catch {
      // Keep demo inbox if Gmail is unavailable.
    }
  };

  const loadCalendar = async () => {
    try {
      const response = await fetch("/api/calendar?days=14", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload?.ok) return;
      lastCalendar = payload;
      window.IH_LIVE_CALENDAR = payload;
      applyLiveCalendar();
    } catch {
      // Keep local calendar if Google Calendar is unavailable.
    }
  };

  const googleResult = new URL(window.location.href).searchParams.get("google");
  if (googleResult && window.toast) {
    setTimeout(() => window.toast(`Google: ${googleResult}`), 500);
  }

  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      applyStatus();
      applyLiveNews();
      applyLiveGmail();
      applyLiveCalendar();
    }, 50);
  });

  setTimeout(() => {
    loadStatus();
    loadNews();
  }, 250);
})();

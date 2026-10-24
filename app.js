(function () {
  const SECTIONS = [
    { id: "all", label: "All" },
    { id: "house", label: "House days" },
    { id: "build", label: "Build / ship" },
    { id: "kin", label: "Kin" },
    { id: "opens", label: "Opens" },
    { id: "held", label: "Held" },
    { id: "made", label: "Made apps" },
  ];

  const STORE_PINS = "the-shelves-pins-v1";
  const STORE_LAST = "the-shelves-last-v1";
  const STORE_TAB = "the-shelves-tab-v1";

  const data = window.SHELVES_DATA || { items: [], meta: {} };
  const items = data.items || [];

  let tab = localStorage.getItem(STORE_TAB) || "all";
  let pinsOnly = false;
  let query = "";
  let pins = loadPins();

  const $tabs = document.getElementById("tabs");
  const $list = document.getElementById("list");
  const $count = document.getElementById("count");
  const $search = document.getElementById("search");
  const $pinsOnly = document.getElementById("pinsOnly");
  const $back = document.getElementById("back");

  function loadPins() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_PINS) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }
  function savePins() {
    localStorage.setItem(STORE_PINS, JSON.stringify([...pins]));
  }

  function blurb(body) {
    return String(body || "")
      .replace(/^#+\s.*/m, "")
      .replace(/[#*_`]/g, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 180);
  }

  function simpleMd(text) {
    const esc = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = String(text || "").split("\n");
    const out = [];
    for (let line of lines) {
      const t = line;
      if (/^###\s+/.test(t)) {
        out.push('<span class="h">' + esc(t.replace(/^###\s+/, "")) + "</span>");
      } else if (/^##\s+/.test(t)) {
        out.push('<span class="h">' + esc(t.replace(/^##\s+/, "")) + "</span>");
      } else if (/^#\s+/.test(t)) {
        out.push('<span class="h h1">' + esc(t.replace(/^#\s+/, "")) + "</span>");
      } else {
        let x = esc(t);
        x = x.replace(
          /(https?:\/\/[^\s<]+)/g,
          '<a href="$1" target="_blank" rel="noopener">$1</a>'
        );
        x = x.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        out.push(x || " ");
      }
    }
    return out.join("\n");
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (tab !== "all" && it.section !== tab) return false;
      if (pinsOnly && !pins.has(it.id)) return false;
      if (!q) return true;
      const hay = [it.title, (it.tags || []).join(" "), it.body, it.sourcePath, it.status || ""]
        .join("\n")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderTabs() {
    $tabs.innerHTML = "";
    SECTIONS.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", s.id === tab ? "true" : "false");
      b.textContent = s.label;
      b.addEventListener("click", () => {
        tab = s.id;
        localStorage.setItem(STORE_TAB, tab);
        render();
      });
      $tabs.appendChild(b);
    });
  }

  function renderList() {
    const list = filtered();
    // pinned first within filter
    list.sort((a, b) => {
      const pa = pins.has(a.id) ? 0 : 1;
      const pb = pins.has(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(b.date || "").localeCompare(String(a.date || "")) ||
        a.title.localeCompare(b.title);
    });
    $count.textContent = list.length + " shelf" + (list.length === 1 ? "" : "s");
    $list.innerHTML = "";
    if (!list.length) {
      $list.innerHTML = '<div class="empty">Nothing on this shelf matches. Try another section or clear search.</div>';
      return;
    }
    list.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card";
      btn.setAttribute("role", "listitem");

      const pinned = pins.has(it.id);
      const tags = (it.tags || []).slice(0, 5);
      if (it.status && /live/i.test(it.status)) tags.unshift("live");
      else if (it.section === "made") tags.unshift("local");
      if ((it.openMarks || []).length) tags.unshift("opens");

      const tagHtml = tags
        .map((t) => {
          const cls =
            t === "opens" || t === "open" ? "open" : t === "live" ? "live" : t === "local" ? "local" : "";
          return '<span class="tag ' + cls + '">' + escapeHtml(t) + "</span>";
        })
        .join("");

      btn.innerHTML =
        '<div class="card-top"><h2></h2><span class="pin-btn" role="button" tabindex="0" aria-label="Pin" aria-pressed="' +
        (pinned ? "true" : "false") +
        '">' +
        (pinned ? "★" : "☆") +
        "</span></div>" +
        '<p class="blurb"></p>' +
        (it.date ? '<div class="date"></div>' : "") +
        '<div class="tags">' +
        tagHtml +
        "</div>";

      btn.querySelector("h2").textContent = it.title;
      btn.querySelector(".blurb").textContent = blurb(it.body) || it.sourcePath || "";
      const d = btn.querySelector(".date");
      if (d) d.textContent = it.date;

      const pinEl = btn.querySelector(".pin-btn");
      pinEl.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePin(it.id);
        renderList();
      });
      pinEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          togglePin(it.id);
          renderList();
        }
      });

      btn.addEventListener("click", () => openReader(it));
      $list.appendChild(btn);
    });
  }

  function togglePin(id) {
    if (pins.has(id)) pins.delete(id);
    else pins.add(id);
    savePins();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openReader(it) {
    document.body.classList.add("reading");
    document.getElementById("r-title").textContent = it.title;
    const bits = [];
    if (it.date) bits.push(it.date);
    bits.push(it.section);
    if (it.sourcePath) bits.push(it.sourcePath);
    if (it.status) bits.push(it.status);
    document.getElementById("r-meta").textContent = bits.join(" · ");

    const actions = document.getElementById("r-actions");
    actions.innerHTML = "";
    const pinB = document.createElement("button");
    pinB.type = "button";
    pinB.className = pins.has(it.id) ? "" : "secondary";
    pinB.textContent = pins.has(it.id) ? "★ Pinned" : "☆ Pin this shelf";
    pinB.addEventListener("click", () => {
      togglePin(it.id);
      pinB.textContent = pins.has(it.id) ? "★ Pinned" : "☆ Pin this shelf";
      pinB.className = pins.has(it.id) ? "" : "secondary";
      renderList();
    });
    actions.appendChild(pinB);

    const url = it.url || (it.links && it.links[0]);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = /127\.0\.0\.1/.test(url) ? "Open local" : "Open live";
      actions.appendChild(a);
    }

    const opens = document.getElementById("r-opens");
    if (it.openMarks && it.openMarks.length) {
      opens.innerHTML =
        '<div class="opens-box"><strong>Opens (from this file)</strong><ul>' +
        it.openMarks.map((o) => "<li>" + escapeHtml(o) + "</li>").join("") +
        "</ul></div>";
    } else {
      opens.innerHTML = "";
    }

    document.getElementById("r-body").innerHTML = simpleMd(it.body);
    try {
      localStorage.setItem(STORE_LAST, it.id);
    } catch (_) {}
    window.scrollTo(0, 0);
  }

  function closeReader() {
    document.body.classList.remove("reading");
    renderList();
  }

  function render() {
    renderTabs();
    renderList();
  }

  $search.addEventListener("input", () => {
    query = $search.value;
    renderList();
  });
  $pinsOnly.addEventListener("click", () => {
    pinsOnly = !pinsOnly;
    $pinsOnly.setAttribute("aria-pressed", pinsOnly ? "true" : "false");
    $pinsOnly.textContent = pinsOnly ? "Show all" : "Pinned only";
    renderList();
  });
  $back.addEventListener("click", closeReader);

  // restore last-opened hint in count bar only; don't auto-open
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }
})();

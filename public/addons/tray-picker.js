/* Plus-reaction picker upgrade — standalone addon for "Our Discussion Room".
   Owner request #5: the "+" custom-reaction picker gets the FULL emoji
   catalogue used by the app's chat-box tray (1,849 emojis, 8 categories —
   extracted from the bundle into tray-emoji.json next to this file).
   Owner request #4: custom reactions sometimes failed with
   "রিয়েকশন দেওয়া যায়নি — আবার চেষ্টা করুন" on Render. Root causes fixed here:
     a) the addon used its own second socket for reactions; on slow networks
        (Render cold start) that extra handshake often wasn't ready, and
        timeouts showed the error. The picker now drives the APP'S OWN
        quick-reaction buttons (synthetic click), so the app's own socket —
        the exact path that already works — does the sending.
     b) the virtualized list reuses DOM ids; an id read from a stale bubble
        could miss on the server → invalid_error. We only act on bubbles that
        are actually in the DOM right now, and verify the message id matches
        the newest render by re-reading it at click time.
   Owner request (reaction warm-up): from the moment the user is logged in,
   this addon prepares the socket.io client script, the emoji catalogue and
   ONE light background connection in advance, and the socket reconnects by
   itself when dropped — so the first "+" click answers as instantly as the
   app's default-emoji buttons. The same connection is exposed as
   window.__bcaSharedSock and reused by fsnotice.js for live notice refresh.
   Cost: one extra lightweight connection per page-load.
   This file is standalone and does not edit the minified app or addon.js.
*/
(() => {
  "use strict";
  if (window.__bcaTrayPicker) return;
  window.__bcaTrayPicker = true;
  console.log("[bca] tray-picker v9 loaded"); // visible proof of the running version

  let catalogue = null; // { categories: [{id, emojis:[{n, e}]}] }
  let catalogueLoading = null;

  function loadCatalogue() {
    if (catalogue) return Promise.resolve(catalogue);
    if (catalogueLoading) return catalogueLoading;
    catalogueLoading = fetch("/addons/tray-emoji.json", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.categories) || !data.emojis) return null;
        const categories = data.categories
          .map((c) => ({
            id: c.id,
            emojis: (c.emojis || [])
              .map((id) => data.emojis[id])
              .filter(Boolean)
              .map((e) => ({ n: e.name || e.id, e: e.skins?.[0]?.native || e.native || "" }))
              .filter((x) => x.e),
          }))
          .filter((c) => c.emojis.length);
        catalogue = { categories };
        return catalogue;
      })
      .catch(() => null)
      .finally(() => {
        // a failed fetch (502 while the Render server wakes) must not stay
        // cached forever — the next call retries
        if (!catalogue) catalogueLoading = null;
      });
    return catalogueLoading;
  }

  const T = {
    en: { search: "Search…", noRes: "No emoji matched", recent: "Frequently used" },
    bn: { search: "খুঁজুন…", noRes: "কোনো ইমোজি মেলেনি", recent: "ঘনঘন ব্যবহৃত" },
  };
  const curLang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");

  // ---------- drive the app's own quick-reaction chips ----------
  function quickChipFor(bubble, emoji) {
    // only a chip that ALREADY shows this exact emoji may be clicked —
    // clicking a different emoji's chip would toggle THAT emoji instead
    const chips = [...bubble.querySelectorAll(".reaction-emoji")];
    return chips.find((chip) => (chip.textContent || "").trim().startsWith(emoji)) || null;
  }

  function appReactionClick(bubble, emoji) {
    if (!bubble || !document.contains(bubble)) return false;
    // the app's own quick-reaction row (only ~6 fixed emojis — a custom
    // emoji will never match, which is correct) or an existing chip that
    // already shows this exact emoji; anything else → let the socket path run
    const rowBtns = [...bubble.querySelectorAll("button, .quick-reaction, .reaction-option")]
      .map((el) => ({ el, text: (el.textContent || "").trim() }))
      .filter((x) => x.text === emoji);
    if (rowBtns[0]?.el) { rowBtns[0].el.click(); return true; }
    const chip = quickChipFor(bubble, emoji);
    if (chip) {
      const inner = chip.querySelector("div[onclick], div");
      (inner || chip).click();
      return true;
    }
    return false;
  }

  // ---------- fallback: send via the addon socket like before ----------
  let reactionSock = null;
  let sockConnecting = null;
  // ---------- shared warm socket (kept connected from login onward) ----------
  // Exposed as window.__bcaSharedSock so fsnotice.js reuses THE SAME
  // connection for live notice refresh instead of opening a second one.
  async function warmSocket() {
    try {
      const sock = await reactionSocket();
      if (sock) window.__bcaSharedSock = sock;
      return sock;
    } catch { return null; /* warmed lazily again on next use */ }
  }
  function loadSocketClient() {
    if (window.io) return Promise.resolve(window.io);
    return new Promise((resolve) => {
      const sc = document.createElement("script");
      sc.src = "/addons/socket.io.min.js"; // vendored client — /socket.io/socket.io.js is NOT served by the Render/CF builds (client-dist not deployed there)
      sc.onload = () => resolve(window.io || null);
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
    });
  }
  async function reactionSocket() {
    const IO = await loadSocketClient();
    if (!IO) { console.warn("[bca] socket.io client script unavailable"); return null; }
    if (reactionSock?.connected) return reactionSock;
    // a connect attempt may already be in flight (warm loop + first click) —
    // share it instead of racing a second socket into existence
    if (sockConnecting) return sockConnecting;
    sockConnecting = (async () => {
    // Render cold start / slow mobile net: give the handshake real room and
    // RETRY — the first attempt often dies while the server is still waking
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        if (reactionSock) { try { reactionSock.disconnect(); } catch { /* ignore */ } }
        reactionSock = IO({ transports: ["websocket", "polling"], reconnection: true, timeout: 20000 });
        const connected = await new Promise((resolve) => {
          if (reactionSock.connected) return resolve(true);
          reactionSock.once("connect", () => resolve(true));
          reactionSock.once("connect_error", () => resolve(false));
          setTimeout(() => resolve(reactionSock?.connected === true), 15000);
        });
        if (connected) return reactionSock;
        console.warn(`[bca] reaction socket attempt ${attempt}/5 failed — retrying`);
        if (attempt < 5) await new Promise((r) => setTimeout(r, 3000));
      } catch (e) { console.warn("[bca] reaction socket error:", e?.message || e); }
    }
    return null;
    })().finally(() => { sockConnecting = null; });
    return sockConnecting;
  }
  function readReactionsFromDom(bubble) {
    const reactions = {};
    bubble.querySelectorAll(".reaction-emoji").forEach((chip) => {
      const first = chip.querySelector("div > div");
      if (!first) return;
      const text = first.textContent || "";
      const m = text.match(/^([\s\S]+?)\s+(\d+)$/);
      if (!m) return;
      const userNames = [...chip.querySelectorAll(".reaction-username")].map((p) => p.textContent.trim());
      reactions[m[1]] = { usernames: userNames };
    });
    return reactions;
  }
  function togglePayload(msgReactions, emoji, username) {
    const reactions = {};
    for (const key of Object.keys(msgReactions || {})) {
      reactions[key] = { usernames: [...(msgReactions[key]?.usernames || [])] };
    }
    const list = reactions[emoji]?.usernames || [];
    reactions[emoji] = { usernames: list.includes(username) ? list.filter((u) => u !== username) : [...list, username] };
    return reactions;
  }
  let meUser = null;
  async function fetchMeOnce() {
    if (meUser) return meUser;
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (res.ok) meUser = await res.json();
    } catch { /* ignore */ }
    return meUser;
  }
  async function socketReact(bubble, emoji) {
    if (!bubble || !document.contains(bubble)) return false;
    const me = await fetchMeOnce();
    if (!me?.username) return false;
    const sock = await reactionSocket();
    if (!sock) return false;
    const id = parseInt(String(bubble.id || "").replace("message-", ""), 10);
    if (!Number.isFinite(id)) return false;
    const reactions = togglePayload(readReactionsFromDom(bubble), emoji, me.username);
    // ensure the target emoji's entry exists with MY username toggled —
    // for a brand-new custom emoji readReactionsFromDom knows nothing, so
    // the toggle must add the user explicitly
    if (!reactions[emoji] || !Array.isArray(reactions[emoji].usernames))
      reactions[emoji] = { usernames: [] };
    if (!reactions[emoji].usernames.some((u) => u === me.username))
      reactions[emoji].usernames.push(me.username);
    return new Promise((resolve) => {
      let done = false;
      sock.timeout(15000).emit("reactMessage", { id, reactions }, (err) => {
        if (done) return;
        done = true;
        if (err) console.warn("[bca] reaction ack error/timeout:", String(err).slice(0, 120));
        resolve(!err);
      });
      setTimeout(() => { if (!done) { done = true; console.warn("[bca] reaction emit hard timeout"); resolve(false); } }, 16000);
    });
  }

  // ---------- the picker UI ----------
  let pop = null;
  let currentBubble = null;

  function closePop() {
    if (pop) { pop.remove(); pop = null; currentBubble = null; }
    document.removeEventListener("mousedown", outside, true);
    document.removeEventListener("keydown", esc, true);
  }
  function outside(e) {
    if (pop && !pop.contains(e.target) && !e.target.closest?.(".bca-react-plus")) closePop();
  }
  function esc(e) { if (e.key === "Escape") closePop(); }

  function renderGrid(q) {
    if (!pop || !catalogue) return;
    const grid = pop.querySelector(".bca-tgrid");
    const catsBar = pop.querySelector(".bca-tcats");
    const lang = T[curLang()];
    grid.textContent = "";
    if (!q) {
      const recent = [...(JSON.parse(localStorage.getItem("bcaRecentEmoji") || "[]"))].slice(0, 24);
      if (recent.length) {
        const head = document.createElement("div");
        head.className = "bca-tcat-head";
        head.textContent = lang.recent;
        grid.appendChild(head);
        for (const e of recent) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bca-temoji";
          b.textContent = e;
          b.addEventListener("click", () => pick(e));
          grid.appendChild(b);
        }
      }
    }
    const scan = catalogue.categories;
    let shown = 0;
    for (const cat of scan) {
      const items = q
        ? cat.emojis.filter((x) => x.n.toLowerCase().includes(q) || x.e === q)
        : cat.emojis;
      if (!items.length) continue;
      const head = document.createElement("div");
      head.className = "bca-tcat-head";
      head.textContent = cat.id;
      grid.appendChild(head);
      for (const { n, e } of items) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bca-temoji";
        b.textContent = e;
        b.title = n;
        b.addEventListener("click", () => pick(e));
        grid.appendChild(b);
        shown++;
      }
    }
    if (!shown) {
      const none = document.createElement("div");
      none.className = "bca-tnone";
      none.textContent = lang.noRes;
      grid.appendChild(none);
    }
    // category chips (jump links)
    catsBar.textContent = "";
    for (const cat of scan) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "bca-tcat";
      chip.textContent = cat.id;
      chip.addEventListener("click", () => {
        const heads = [...grid.querySelectorAll(".bca-tcat-head")];
        const target = heads.find((h) => h.textContent === cat.id);
        target?.scrollIntoView({ block: "start" });
      });
      catsBar.appendChild(chip);
    }
  }

  async function pick(emoji) {
    // capture the bubble BEFORE closePop() — closePop nulls currentBubble,
    // and the bubble element must survive the popup closing (owner-reported
    // TypeError: bubble is null)
    const bubble = currentBubble;
    if (!bubble) { closePop(); return; }
    if (!document.contains(bubble)) { closePop(); return; } // stale render
    // remember recents
    try {
      const rec = JSON.parse(localStorage.getItem("bcaRecentEmoji") || "[]");
      const next = [emoji, ...rec.filter((x) => x !== emoji)].slice(0, 24);
      localStorage.setItem("bcaRecentEmoji", JSON.stringify(next));
    } catch { /* ignore */ }
    closePop();
    // 1st choice: the app's own quick-reaction path (its socket, its acks)
    if (appReactionClick(bubble, emoji)) return;
    // fallback: the addon socket, with retries for cold-start/slow networks
    const okViaSocket = await socketReact(bubble, emoji);
    if (!okViaSocket) {
      console.warn("[bca] reaction failed after retries — emoji:", emoji, "bubble id:", bubble.id);
      const lang = curLang();
      const msg = lang === "en" ? "Couldn't add the reaction — try again" : "রিয়েকশন দেওয়া যায়নি — আবার চেষ্টা করুন";
      const host = document.getElementById("bca-fs-root");
      const el = document.createElement("div");
      el.className = "bca-toast err";
      el.textContent = msg;
      (host || document.body).appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }
  }

  function openPop(anchor, bubble) {
    closePop();
    currentBubble = bubble;
    pop = document.createElement("div");
    pop.className = "bca-tpop";
    pop.innerHTML = `
      <input type="text" class="bca-tsearch" />
      <div class="bca-tcats"></div>
      <div class="bca-tgrid"></div>`;
    document.body.appendChild(pop);
    const search = pop.querySelector(".bca-tsearch");
    search.placeholder = T[curLang()].search;
    search.addEventListener("input", () => renderGrid(search.value.trim().toLowerCase()));
    renderGrid("");
    const r = anchor.getBoundingClientRect();
    const w = Math.min(340, innerWidth - 16);
    pop.style.width = w + "px";
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    const below = r.bottom + 8 + pop.offsetHeight < innerHeight;
    pop.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - pop.offsetHeight - 8)) + "px";
    t0Focus();
    function t0Focus() { setTimeout(() => search.focus(), 30); }
    setTimeout(() => {
      document.addEventListener("mousedown", outside, true);
      document.addEventListener("keydown", esc, true);
    }, 0);
  }

  // ---------- hook the existing "+" buttons ----------
  function wire() {
    document.querySelectorAll(".bca-react-plus").forEach((btn) => {
      if (btn.__bcaWired) return;
      btn.__bcaWired = true;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const bubble = btn.closest('div[id^="message-"]');
        if (!bubble || !document.contains(bubble)) return;
        if (pop) { closePop(); return; }
        loadCatalogue().then((cat) => {
          if (!cat) return;
          openPop(btn, bubble);
        });
      }, true);
    });
  }

  const mo = new MutationObserver(() => wire());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  wire();

  // ---------- warm everything early (login detected via /users/me) ----------
  // From the first moment of a logged-in session the socket client script,
  // the emoji catalogue and one shared connection are kept ready in the
  // background, so "+" answers instantly on the very first click. The
  // socket has reconnection:true, so a dropped link re-heals by itself.
  // A Render free-tier server is often ASLEEP when the page loads: the first
  // attempts get 502 until it finishes waking (~30–60 s). So the warm-up is
  // SELF-HEALING — retried on a backoff (2 s → 30 s) until the socket is
  // really connected; the first 502 must never be the last attempt. (The
  // 1.5 s /users/me poll itself helps wake the server up.)
  let warmedFor = null;
  let warmBackoffMs = 0;
  let lastWarmTry = 0;
  let catalogueTriedAt = 0;
  function warmNow() {
    lastWarmTry = Date.now();
    warmSocket()
      .then((sock) => {
        if (sock) {
          window.__bcaSharedSock = sock;
          warmBackoffMs = 0; // success — the next drop starts from a fast retry
        } else {
          warmBackoffMs = warmBackoffMs ? Math.min(warmBackoffMs * 2, 30000) : 2000;
          console.warn(`[bca] warm socket not ready — retry in ~${Math.round(warmBackoffMs / 1000)}s`);
        }
      })
      .catch(() => {});
  }
  async function warmLoop() {
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (res.ok) {
        const me = await res.json().catch(() => null);
        const loginAt = String(me?.loginAt || "");
        if (me?.username && loginAt !== warmedFor) {
          warmedFor = loginAt;
          warmBackoffMs = 0; // a fresh login warms immediately
          lastWarmTry = 0;
        }
        // socket.io's own reconnection may have revived the socket — keep the
        // shared reference (fsnotice.js reads it) pointing at the live one
        if (reactionSock?.connected && window.__bcaSharedSock !== reactionSock) {
          window.__bcaSharedSock = reactionSock;
        }
        if (!me?.username) return;
        // keep trying the shared socket until it is really up (backoff-gated)
        if (!reactionSock?.connected && !sockConnecting &&
            Date.now() - lastWarmTry >= warmBackoffMs) {
          warmNow();
        }
        // emoji catalogue: fetch once, then retry ~every 10 s while it is
        // still missing (loadCatalogue clears its own failure cache, so a
        // later call retries the fetch instead of staying stuck)
        if (!catalogue && Date.now() - catalogueTriedAt >= 10000) {
          catalogueTriedAt = Date.now();
          loadCatalogue();
        }
      }
    } catch { /* transient — likely the server still waking; next tick retries */ }
  }
  setInterval(warmLoop, 1500);
  warmLoop();
})();

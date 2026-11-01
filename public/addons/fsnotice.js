/* Fullscreen login notice — standalone addon for "Our Discussion Room".
   Self-contained on purpose: it never touches public/addons/addon.js.
   Features:
   1) After every LOGIN (not on plain reloads) a black fullscreen DIV — no
      iframe, mobile-friendly — shows the admin's raw HTML/CSS/JS notice;
      the OK button ("বুঝেছি") hands the user back to the app. A TALL notice
      starts at the TOP; a SHORT one is centered vertically inside the div.
   2) The editor lives ONLY in the /admin page — a card right next to the
      app's own notice card, following the app's light/dark theme.
   3) While the overlay is open a socket event (updateFsNotice) refreshes it
      live when the admin saves a new version.
   4) Chat scroll guard: the bundled app force-jumps to the very bottom on
      every new message. This addon stops that jump while the user is reading
      mid-history, and keeps following the tail ONLY while the user is already
      at the bottom.
   Backend endpoints: GET/PUT /api/chat/getFsNotice|updateFsNotice
   (older backends answer 404 → the feature silently stays off).
*/
(() => {
  "use strict";
  if (window.__bcaFsNotice) return;
  window.__bcaFsNotice = true;

  // ---------- tiny shared bits ----------
  const FS_SEEN_KEY = "bcaFsNoticeSeenLoginAt";
  let fsNoticeCache = null; // { notice, updatedAt } — null = not fetched yet
  let fsSupported = true;   // flips false on a 404 (older backend)
  let loggedIn = false;
  let me = null;
  let shownFor = null;      // loginAt already shown during this page-load
  let sock = null;

  const curLang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");
  const STRINGS = {
    en: {
      ok: "Understood",
      editorTitle: "Fullscreen notice",
      editorLabel: "HTML / CSS / JS code (one line)",
      editorHint: "A black fullscreen page showing this HTML/CSS/JS — every user sees it right after login and presses the button to enter the chat. Write it as ONE line; use <br> for line breaks. Tall notices start at the top, short ones are centered. It loads only for logged-in users, once per login.",
      save: "Save notice",
      saving: "Saving…",
      preview: "Preview",
      clear: "Clear",
      clearConfirm: "Clear the fullscreen notice? It saves empty immediately — nobody will see it on the next login.",
      savedMsg: "✓ Fullscreen notice saved",
      tooLarge: "The code is too large — shorten it a little",
      sessionExpired: "Session expired — reload the page and log in again",
      noServer: "Can't reach the server",
      saved: "✓ Saved",
      fetchFail: "Couldn't load data",
      chars: "chars",
      cardBadge: "addon",
    },
    bn: {
      ok: "বুঝেছি",
      editorTitle: "ফুল স্ক্রিন নোটিশ",
      editorLabel: "HTML / CSS / JS কোড (এক লাইন)",
      editorHint: "কালো ফুল-স্ক্রিন পেজে এই HTML/CSS/JS-ই দেখাবে — প্রত্যেক ইউজার লগইনের পরপরই এটা দেখবে, বাটন চাপলে চ্যাটে ঢুকবে। এক লাইনে লিখুন; লাইন ভাঙতে <br> দিন। বড় নোটিশ উপর থেকে শুরু হয়, ছোটটা মাঝখানে দেখায়। লোড হয় শুধু লগইন-করা ইউজারের জন্য, লগইনে একবার।",
      save: "নোটিশ সেভ করুন",
      saving: "সেভ হচ্ছে…",
      preview: "প্রিভিউ",
      clear: "মুছে ফেলুন",
      clearConfirm: "ফুল স্ক্রিন নোটিশ মুছে ফেলব? সাথে সাথে খালি সেভ হবে — পরের লগইনে আর কেউ দেখবে না।",
      savedMsg: "✓ ফুল স্ক্রিন নোটিশ সেভ হয়েছে",
      tooLarge: "কোডটা অনেক বড় — একটু ছোট করুন",
      sessionExpired: "সেশন শেষ — পেজ রিলোড করে আবার লগইন করুন",
      noServer: "সার্ভারে পৌঁছানো যাচ্ছে না",
      saved: "✓ সেভ হয়েছে",
      fetchFail: "তথ্য আনা যায়নি",
      chars: "অক্ষর",
      cardBadge: "অ্যাড-অন",
    },
  };
  const S = () => STRINGS[curLang()];
  const appIsDark = () => !!document.querySelector(".navbar.bg-dark");

  function host() {
    let el = document.getElementById("bca-fs-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "bca-fs-root";
      document.body.appendChild(el);
    }
    return el;
  }

  async function fetchJson(path, opts) {
    const res = await fetch(path, { credentials: "same-origin", ...(opts || {}) });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  // ---------- fullscreen overlay ----------
  function fsSeenLoginAt() {
    try { return localStorage.getItem(FS_SEEN_KEY) || ""; } catch { return ""; }
  }
  function markFsSeen(loginAt) {
    try { localStorage.setItem(FS_SEEN_KEY, loginAt || "?"); } catch { /* private mode */ }
  }

  /** innerHTML leaves <script> nodes inert — recreate them so admin JS runs */
  function activateScripts(container) {
    container.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      if (old.src) s.src = old.src;
      s.type = old.type || "text/javascript";
      s.text = old.textContent || "";
      old.parentNode.replaceChild(s, old);
    });
  }

  function closeOverlay() {
    host().querySelectorAll(".bca-fsoverlay").forEach((x) => x.remove());
    document.body.classList.remove("bca-fslock");
  }

  function showOverlay(html) {
    closeOverlay();
    const overlay = document.createElement("div");
    overlay.className = "bca-fsoverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="bca-fscontent"><div class="bca-fsinner"></div></div>
      <div class="bca-fsbar">
        <button type="button" class="bca-fsok"></button>
      </div>`;
    const okBtn = overlay.querySelector(".bca-fsok");
    okBtn.textContent = S().ok;
    okBtn.addEventListener("click", closeOverlay);
    const inner = overlay.querySelector(".bca-fsinner");
    // admin-authored raw html/css/js — the SAME trust decision as the
    // attendance counter page (server stores it raw, only admins write)
    inner.innerHTML = html;
    activateScripts(inner);
    host().appendChild(overlay);
    document.body.classList.add("bca-fslock");
    // tall notice → starts at the TOP and scrolls down to read; short
    // notice → the CSS auto-margins center it vertically inside the div
  }

  async function refetchNotice() {
    const got = await fetchJson("/api/chat/getFsNotice");
    if (got.status === 404) { fsSupported = false; return null; }
    if (got.status !== 200 || !got.body) return null; // transient
    fsNoticeCache = {
      notice: typeof got.body.notice === "string" ? got.body.notice : "",
      updatedAt: got.body.updatedAt || "",
    };
    return fsNoticeCache;
  }

  /** show the notice when this is a NEW login (loginAt changed); plain
      reloads keep the same loginAt, so they never re-show it */
  async function maybeShow() {
    if (!loggedIn || !me || !fsSupported) return;
    // the addon's forced-credentials modal has priority — never stack on it
    if (document.querySelector(".bca-overlay")) return;
    if (host().querySelector(".bca-fsoverlay")) return;
    const html = (fsNoticeCache && fsNoticeCache.notice) || "";
    if (!html.trim()) return;
    const loginAt = String((me && me.loginAt) || "");
    if (shownFor !== null && shownFor === loginAt) return;
    if (loginAt && fsSeenLoginAt() === loginAt) return;
    shownFor = loginAt;
    markFsSeen(loginAt);
    showOverlay(html);
  }

  // ---------- socket (live refresh while the overlay is open) ----------
  function loadSocketClient() {
    if (window.io) return Promise.resolve(window.io);
    return new Promise((resolve) => {
      const sc = document.createElement("script");
      sc.src = "/socket.io/socket.io.js";
      sc.onload = () => resolve(window.io || null);
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
    });
  }
  async function hookSocket() {
    const IO = await loadSocketClient();
    if (!IO || sock) return;
    try {
      sock = IO({ transports: ["websocket", "polling"], reconnection: true });
      sock.on("updateFsNotice", async () => {
        fsNoticeCache = null;
        await refetchNotice();
        if (host().querySelector(".bca-fsoverlay") && fsNoticeCache) showOverlay(fsNoticeCache.notice);
      });
    } catch { /* live refresh is optional */ }
  }

  // ---------- editor (the /admin card) ----------
  function makeEditor(box) {
    const s = S();
    box.classList.add("bca-fssetting");
    box.innerHTML = `
      <div class="bca-fslabel"></div>
      <div class="bca-fshint2"></div>
      <textarea class="bca-fseditor" spellcheck="false" wrap="off"></textarea>
      <div class="bca-fsbar2">
        <span class="bca-fscount"></span>
        <span class="bca-fsmsg"></span>
        <button type="button" class="bca-fsmini bca-fspreview"></button>
        <button type="button" class="bca-fssave"></button>
        <button type="button" class="bca-fsmini bca-fsclear"></button>
      </div>`;
    box.querySelector(".bca-fslabel").textContent = s.editorLabel;
    box.querySelector(".bca-fshint2").textContent = s.editorHint;
    const editor = box.querySelector(".bca-fseditor");
    const count = box.querySelector(".bca-fscount");
    const msg = box.querySelector(".bca-fsmsg");
    const saveBtn = box.querySelector(".bca-fssave");
    const previewBtn = box.querySelector(".bca-fspreview");
    const clearBtn = box.querySelector(".bca-fsclear");
    saveBtn.textContent = s.save;
    previewBtn.textContent = s.preview;
    clearBtn.textContent = s.clear;
    const LIMIT = 100000;
    const paintCount = () => {
      count.textContent = `${editor.value.length.toLocaleString()} / ${LIMIT.toLocaleString()} ${s.chars}`;
      count.classList.toggle("over", editor.value.length > LIMIT);
    };
    editor.addEventListener("input", () => { paintCount(); msg.textContent = ""; });

    const saveNow = async (overrideHtml) => {
      const html = typeof overrideHtml === "string" ? overrideHtml : editor.value;
      if (html.length > LIMIT) { msg.textContent = s.tooLarge; return false; }
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = s.saving;
      msg.textContent = "";
      try {
        const res = await fetch("/api/chat/updateFsNotice", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notice: html }),
        });
        if (res.status === 401) { msg.textContent = s.sessionExpired; return false; }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          msg.textContent = body && body.errorMessage ? body.errorMessage : s.fetchFail;
          return false;
        }
        editor.value = html;
        paintCount();
        msg.textContent = s.saved;
        fsNoticeCache = { notice: html, updatedAt: new Date().toISOString() };
        return true;
      } catch {
        msg.textContent = s.noServer;
        return false;
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
    };

    saveBtn.addEventListener("click", () => saveNow());
    previewBtn.addEventListener("click", () => { if (editor.value.trim()) showOverlay(editor.value); });
    clearBtn.addEventListener("click", async () => {
      if (!window.confirm(s.clearConfirm)) return;
      editor.value = "";
      paintCount();
      await saveNow("");
    });

    refetchNotice().then(() => {
      if (fsNoticeCache) { editor.value = fsNoticeCache.notice; paintCount(); }
    });
  }

  // ---------- /admin page: a card next to the app's own notice card ----------
  let adminCard = null;
  function removeAdminCard() {
    if (adminCard) { adminCard.remove(); adminCard = null; }
  }
  function ensureAdminCard() {
    if (!loggedIn || !me || !me.isAdmin || !fsSupported) { removeAdminCard(); return; }
    if (!/\/admin\b/.test(location.pathname)) { removeAdminCard(); return; }
    const noticeTextarea = document.getElementById("notice-body");
    if (!noticeTextarea) return; // admin page not rendered (yet)
    if (adminCard && document.contains(adminCard)) return;
    const s = S();
    const noticeCol = noticeTextarea.closest('[class*="col-"]') || noticeTextarea.closest(".card")?.parentElement;
    if (!noticeCol || !noticeCol.parentElement) return;
    const col = document.createElement("div");
    col.className = noticeCol.className.replace(/mb-\d+/, "mb-3"); // same grid column as the notice card
    col.innerHTML = `
      <div class="card bca-fsadmincard">
        <div class="card-body">
          <h5 class="card-title"><span class="bca-fsbadge"></span> <span class="bca-fscardtitle"></span></h5>
          <div class="bca-fscardmount"></div>
        </div>
      </div>`;
    col.querySelector(".bca-fsbadge").textContent = s.cardBadge;
    col.querySelector(".bca-fscardtitle").textContent = s.editorTitle;
    makeEditor(col.querySelector(".bca-fscardmount"));
    noticeCol.parentElement.insertBefore(col, noticeCol.nextSibling); // right beside the notice card
    adminCard = col;
  }

  // ---------- chat scroll guard ----------
  // The bundled app does `scroller.scrollTop = scroller.scrollHeight` on every
  // new message, which yanks a reader from mid-history. We remember whether
  // the user was at the bottom: if yes, keep following the tail (new messages
  // slide in and we stay pinned to the newest); if not, undo the yank by
  // restoring the reader's position.
  const scrollerState = new WeakMap(); // el -> { sticky, savedTop, hooked, observer }

  function findChatScroller() {
    const node = document.querySelector('div[id^="message-"]');
    let el = node?.parentElement;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 50) return el;
      el = el.parentElement;
    }
    return null;
  }

  function hookScroller(sc) {
    let st = scrollerState.get(sc);
    if (!st) {
      st = { sticky: false, savedTop: null, hooked: false, observer: null };
      scrollerState.set(sc, st);
    }
    if (!st.hooked) {
      st.hooked = true;
      sc.addEventListener("scroll", () => {
        const atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
        if (atBottom) {
          st.sticky = true;
        } else {
          st.sticky = false;
          st.savedTop = sc.scrollTop;
        }
      }, { passive: true });
      st.observer = new MutationObserver((muts) => {
        // only react when actual message nodes were added/removed
        let relevant = false;
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && (n.matches?.('div[id^="message-"]') || n.querySelector?.('div[id^="message-"]'))) { relevant = true; break; }
          }
          if (relevant) break;
        }
        if (!relevant) return;
        setTimeout(() => {
          if (st.sticky) {
            sc.scrollTop = sc.scrollHeight; // keep pinned to the newest message
          } else if (st.savedTop !== null && Math.abs(sc.scrollTop - st.savedTop) > 4) {
            sc.scrollTop = st.savedTop; // undo the app's forced jump
          }
        }, 30);
      });
      st.observer.observe(sc, { childList: true, subtree: true });
    }
  }

  function ensureScrollGuard() {
    const sc = findChatScroller();
    if (sc) hookScroller(sc);
  }

  // ---------- session poller (1.2 s — mirrors the main addon) ----------
  let lastLang = curLang();
  let lastLoginAt = null;
  async function evaluate() {
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) {
        if (loggedIn) {
          loggedIn = false; me = null; fsNoticeCache = null; shownFor = null; lastLoginAt = null;
          closeOverlay(); removeAdminCard();
        }
        return;
      }
      const next = await res.json().catch(() => null);
      if (!next) return;
      loggedIn = true;
      me = next;
      // a changed loginAt = a fresh login (also catches in-app logout→login
      // without a page reload) — refetch and show once per login
      const loginAt = String(next.loginAt || "");
      if (loginAt !== lastLoginAt) {
        lastLoginAt = loginAt;
        if (fsSupported) await refetchNotice();
        maybeShow();
      }
      // follow the app's light/dark theme for the /admin card + overlay bits
      document.body.classList.toggle("bca-fs-dark", appIsDark());
      ensureAdminCard();
      ensureScrollGuard();
      if (curLang() !== lastLang) {
        lastLang = curLang();
        const okBtn = host().querySelector(".bca-fsok");
        if (okBtn) okBtn.textContent = S().ok;
        const title = document.querySelector(".bca-fscardtitle");
        if (title) title.textContent = S().editorTitle;
        const badge = document.querySelector(".bca-fsbadge");
        if (badge) badge.textContent = S().cardBadge;
      }
    } catch { /* transient network hiccup */ }
  }

  setInterval(evaluate, 1200);
  evaluate();
  hookSocket();
})();

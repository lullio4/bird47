/* UI fixes — standalone addon for "Our Discussion Room" (owner requests 2+3):
   #2: when the online-users list is hidden for regular users, the app still
       renders an EMPTY right-hand column (d-none class flips per screen
       size) and a "maximize" button — hide both completely.
   #3: while a slow login is still in progress (the main addon's navbar
       buttons aren't ready yet), a floating copy button (bca-fab) from the
       main addon may flash in the bottom-right corner. The main addon
       removes the FAB itself once the navbar mounts; we only make sure it
       never appears for logged-out/anonymous visitors and never stays
       without a navbar group — purely visual, no behavior changes.
   #4 (owner request): the bundled app renders the admin-panel link as
       <a href="/admin" target="_blank"> — it sometimes opens a NEW TAB.
       The minified bundle must not be edited (project rule), so the fix
       lives in the EXISTING loop below (no new file/page variation needed).
*/
(() => {
  "use strict";
  if (window.__bcaUiFixes) return;
  window.__bcaUiFixes = true;

  let isAdmin = null; // null = unknown yet
  // ---------- shared session hub (owner request: এক কল, সবাই শোনে) ----------
  // ui-fixes owns THE single /api/users/me poll. The other addons read
  // window.__bcaSession instead of polling themselves — logged-out pages
  // fire ~10 requests/min instead of ~200.
  let sessionPollDelay = 6000; // logged out: 6 s; logged in: 1.2 s
  function broadcastSession(loggedIn, me) {
    const prev = window.__bcaSession;
    const wasIn = !!(prev && prev.loggedIn);
    const nowIn = !!loggedIn;
    window.__bcaSession = { loggedIn: nowIn, me: me || null, at: Date.now() };
    // transition event: the SPA login navigates WITHOUT a reload, and the
    // consumers (addon buttons, picker, fsnotice, autopilot) only re-read the
    // hub on their own timers — a 401→200 flip must wake them immediately
    // (owner report 2026-11-07: admin icons missing until a manual reload)
    if (wasIn !== nowIn) {
      window.dispatchEvent(new CustomEvent("bca:session", { detail: { loggedIn: nowIn, me: me || null } }));
    }
  }
  async function probe() {
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) {
        isAdmin = null;
        broadcastSession(false, null);
        sessionPollDelay = 6000; // logged out: sparse probing
        return;
      }
      const me = await res.json().catch(() => null);
      isAdmin = !!me?.isAdmin;
      broadcastSession(true, me);
      sessionPollDelay = 1200; // logged in: dense (buttons/marquee react fast)
    } catch { /* keep last */ }
  }

  function apply() {
    const styleEl = document.getElementById("bca-uifixes-style") || (() => {
      const el = document.createElement("style");
      el.id = "bca-uifixes-style";
      document.head.appendChild(el);
      return el;
    })();
    // #2: non-admin + hidden list → the right column keeps only empty shells;
    //     admins always see everything
    const hideRightBox = isAdmin === false && localStorage.getItem("bcaUsersPanelHidden") === "1";
    styleEl.textContent = hideRightBox
      ? `
      /* empty online-users column: only the one that contains no real content */
      .special-column:not(:has(.peoples-head .bca-user, .bca-userlist .bca-user)):has(.peoples-head) { display: none !important; }`
      : "";
  }

  // the main addon marks the hidden state on <body> via its own logic; to
  // avoid coupling, we detect it the same way it does: a non-admin visitor
  // with the users-panel elements currently display:none
  function detectHiddenPanel() {
    const col = [...document.querySelectorAll(".special-column")].find((c) => c.querySelector(".peoples-head, .search-box"));
    if (col) {
      localStorage.setItem("bcaUsersPanelHidden", col.style.display === "none" ? "1" : "0");
    }
  }

  let fabFixed = false;
  function fixFab() {
    if (fabFixed) return;
    // #3: never show the fallback FAB to anonymous visitors; the main addon
    // removes it as soon as the navbar group exists — we only police the
    // logged-out window (probe result) and let everything else alone
    if (isAdmin === false || isAdmin === null) {
      document.querySelectorAll(".bca-fab").forEach((fab) => {
        if (!document.querySelector(".navbar.fixed-top .bca-navcopy")) {
          if (isAdmin === null) return; // unknown yet — don't touch
          fab.remove();
        }
      });
    }
  }

  // #4: the app's own admin link must open in the SAME tab (owner request).
  // Runs inside the existing 1.2 s loop — no separate file/wiring needed.
  function fixAdminLinks() {
    document.querySelectorAll('a[href="/admin"][target="_blank"]').forEach((a) => {
      a.target = "_self";
      a.removeAttribute("rel"); // noopener is only meaningful for _blank
    });
  }

  // #5: the bundled app hardcodes "Our Discussion Room 2.4" in document.title
  // (minified Jl() helper, set on every route render). The version lives in
  // package.json (now 4.0.0) — so we rewrite the stale suffix in the DOM
  // title; the loop re-applies it whenever React resets it.
  function fixTitle() {
    const t = document.title;
    if (t.includes("Our Discussion Room 2.4")) {
      document.title = t.split("Our Discussion Room 2.4").join("Our Discussion Room 4.0");
    } else if (t.includes(" 2.4")) {
      document.title = t.replace(/ 2\.4(\b|$)/, " 4.0");
    }
  }

  // probe pacing (owner report): every 1.2 s while logged in, 6 s while
  // logged out — but a VISIBLE LOGIN FORM means the user is typing right
  // now (owner task 2026-11-07: the post-login icons appeared only after a
  // manual refresh) — probe densely so the 401→200 flip is caught within
  // ~2 s and the bca:session event fires while the chat is mounting.
  const loginFormVisible = () =>
    [...document.querySelectorAll('input[type="password"]')].some((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    });
  let uiTick = 0;
  async function uiLoop() {
    uiTick++;
    // single /api/users/me poll (the session hub); DOM fixes run every tick
    await probe();
    detectHiddenPanel();
    apply();
    fixFab();
    fixAdminLinks();
    fixTitle();
    // dense while logged in (1.2 s), while the login form is on screen
    // (1.2 s), otherwise sparse (6 s) — anonymous visitors still stay light
    const dense = sessionPollDelay === 1200 || loginFormVisible();
    setTimeout(uiLoop, dense ? 1200 : 6000);
  }
  uiLoop();
  fixAdminLinks();
  fixTitle();
})();

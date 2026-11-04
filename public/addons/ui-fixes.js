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
  async function probe() {
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) { isAdmin = null; return; }
      const me = await res.json().catch(() => null);
      isAdmin = !!me?.isAdmin;
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

  let tick = 0;
  setInterval(async () => {
    if (tick++ % 5 === 0) await probe(); // every 6 s
    detectHiddenPanel();
    apply();
    fixFab();
    fixAdminLinks();
  }, 1200);
  probe().then(() => { apply(); });
  fixAdminLinks();
})();

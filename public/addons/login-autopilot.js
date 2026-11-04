/* Login autopilot — standalone addon for "Our Discussion Room".
   Owner request: "লগইন করার পর সেই পেইজেই অনেকক্ষন বসে থাকে (401) — সমাধান কর"।
   Root cause (not a socket problem — the addon layer runs ZERO websockets):
   the Render free-tier server sleeps; the page renders from browser cache
   instantly, but the login POST hangs until the server wakes + boots
   (~30–60 s), and sometimes the SPA misses the (successful) answer — a
   manual refresh then enters, because the session cookie is already set.

   What this addon does (plain HTTP only):
   1) While logged out it stays COMPLETELY SILENT (owner request) — just
      polls /api/users/me every 1.5 s to detect the login moment.
   2) The MOMENT the session becomes valid (401→200 = fresh login): if the
      login form is STILL on screen (password field visible) it reloads ONCE
      after a short beat — the user enters the chat without touching F5.
      COMPLETELY SILENT by design (owner request): no chips, no texts.
   3) Skips everything while mustChangePassword (the forced-credentials
      modal owns the screen then) and never reloads when an addon modal is
      open. Steady logged-in state → fully passive.
*/
(() => {
  "use strict";
  if (window.__bcaLoginAutopilot) return;
  window.__bcaLoginAutopilot = true;
  console.log("[bca] login-autopilot v1 loaded");


  let lastOk = false;  // previous probe: logged in?
  let handled = false; // this 401→200 transition already handled
  let probing = false;

  async function probe() {
    if (probing) return;
    probing = true;
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) {
        // logged out — stay completely silent (owner request: no hint text)
        lastOk = false;
        handled = false;
        return;
      }
      const me = await res.json().catch(() => null);
      if (!me?.username) { lastOk = false; handled = false; return; }
      if (me.mustChangePassword) { return; } // forced-change modal owns the screen
      if (lastOk) { return; } // steady logged-in — nothing to do
      // fresh 401→200 transition = a login just succeeded
      handled = true;
      lastOk = true;
      // silent enter (owner request): no chip, no text — just auto-reload
      // once if the SPA missed the successful login
      setTimeout(() => {
        const pwVisible = !!document.querySelector('input[type="password"]');
        const addonModal = !!document.querySelector(".bca-overlay");
        if (pwVisible && !addonModal) location.reload();
      }, 2500);
    } catch { /* transient network hiccup */ }
    finally { probing = false; }
  }
  setInterval(probe, 1500);
  probe();
})();

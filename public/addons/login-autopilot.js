/* Login autopilot — standalone addon for "Our Discussion Room".
   v6 (owner: "ঘোরাটা বাদ দাও — বিরক্তিকর"): the spinner overlay is GONE.
   The only remaining behavior: when a login actually lands (401→200) and
   the app still shows the login form after a short beat, reload ONCE per
   browser (localStorage counter) so the user lands in the chat. Nothing
   spins, nothing covers the screen, nothing else fires.
*/
(() => {
  "use strict";
  if (window.__bcaLoginAutopilot) return;
  window.__bcaLoginAutopilot = true;
  console.log("[bca] login-autopilot v6 loaded");

  function visiblePassword() {
    for (const el of document.querySelectorAll('input[type="password"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return true;
    }
    return false;
  }

  let lastOk = false;
  let probing = false;
  async function probe() {
    if (probing) return;
    probing = true;
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) { lastOk = false; return; } // logged out
      const me = await res.json().catch(() => null);
      if (!me?.username) { lastOk = false; return; }
      if (me.mustChangePassword) return; // forced-change modal owns the screen
      if (lastOk) return; // steady logged-in — passive
      lastOk = true; // fresh 401→200 = login just landed
      // one silent reload per browser if the app missed the login
      setTimeout(() => {
        let reloads = 0;
        try { reloads = Number(localStorage.getItem("bcaAutoRelN") || 0); } catch { /* private mode */ }
        if (visiblePassword() && !document.querySelector(".bca-overlay") && reloads < 1) {
          try { localStorage.setItem("bcaAutoRelN", String(reloads + 1)); } catch { /* private mode */ }
          location.reload();
        }
      }, 1500);
    } catch { /* transient — next tick retries */ }
    finally { probing = false; }
  }
  setInterval(probe, 1200);
  probe();
})();

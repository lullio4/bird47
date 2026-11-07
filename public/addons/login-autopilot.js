/* Login autopilot — standalone addon for "Our Discussion Room".
   v7 (owner request: "লগআউটে কল করবা কেন? এক কল, সবাই শোনে"): NO own poll at
   all — ui-fixes.js owns the single /api/users/me request and broadcasts
   window.__bcaSession. We only watch for the logged-out→logged-in
   transition and, if the app still shows the login form after a short
   beat, reload ONCE per browser (localStorage counter). Completely silent.
*/
(() => {
  "use strict";
  if (window.__bcaLoginAutopilot) return;
  window.__bcaLoginAutopilot = true;
  console.log("[bca] login-autopilot v7 loaded");

  function visiblePassword() {
    for (const el of document.querySelectorAll('input[type="password"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return true;
    }
    return false;
  }

  let hubState;
  setInterval(() => {
    const sess = window.__bcaSession;
    if (!sess) return; // hub (ui-fixes.js) not mounted yet
    if (sess.loggedIn) {
      if (sess.me?.mustChangePassword) return; // forced modal owns the screen
      if (hubState !== true) {
        hubState = true; // fresh 401→200 = login just landed
        // one silent reload per browser if the app missed the login
        setTimeout(() => {
          let reloads = 0;
          try { reloads = Number(localStorage.getItem("bcaAutoRelN") || 0); } catch { /* private mode */ }
          if (visiblePassword() && !document.querySelector(".bca-overlay") && reloads < 1) {
            try { localStorage.setItem("bcaAutoRelN", String(reloads + 1)); } catch { /* private mode */ }
            location.reload();
          }
        }, 1500);
      }
    } else if (hubState !== false) {
      hubState = false;
    }
  }, 1200);
})();

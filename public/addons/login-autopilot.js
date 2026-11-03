/* Login autopilot — standalone addon for "Our Discussion Room".
   Owner request: "লগইন করার পর সেই পেইজেই অনেকক্ষন বসে থাকে (401) — সমাধান কর"।
   Root cause (not a socket problem — the addon layer runs ZERO websockets):
   the Render free-tier server sleeps; the page renders from browser cache
   instantly, but the login POST hangs until the server wakes + boots
   (~30–60 s), and sometimes the SPA misses the (successful) answer — a
   manual refresh then enters, because the session cookie is already set.

   What this addon does (plain HTTP only):
   1) While logged out, polls /api/users/me every 1.5 s (the same tiny probe
      every other addon already makes) and shows a hint chip: the wait is the
      server waking, it self-heals.
   2) The MOMENT the session becomes valid (401→200 = fresh login) it gives
      the app's own navigation a beat; if the login form is STILL on screen
      (password field visible) it reloads ONCE — the user enters the chat
      without touching F5.
   3) Skips everything while mustChangePassword (the forced-credentials
      modal owns the screen then) and never reloads when an addon modal is
      open. Steady logged-in state → the chip hides and it stays passive.
*/
(() => {
  "use strict";
  if (window.__bcaLoginAutopilot) return;
  window.__bcaLoginAutopilot = true;
  console.log("[bca] login-autopilot v1 loaded");

  const curLang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");
  const T = {
    en: {
      hint: "Free-tier server may take 30–60 s to wake — wait right after logging in; you'll enter automatically.",
      entering: "✓ Logged in — entering the chat…",
    },
    bn: {
      hint: "ফ্রি-টিয়ার সার্ভার জাগতে ৩০–৬০ সেকেন্ড লাগতে পারে — লগইনের পর একটু অপেক্ষা করুন; নিজে থেকেই ঢুকে যাবেন।",
      entering: "✓ লগইন হয়েছে — চ্যাটে ঢুকছি…",
    },
  };

  let chip = null;
  function chipText(msg) {
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "bca-login-chip";
      chip.style.cssText =
        "position:fixed;left:12px;bottom:12px;z-index:99999;" +
        "background:rgba(20,20,20,.85);color:#fff;padding:8px 14px;border-radius:999px;" +
        "font:600 12.5px/1.4 'Segoe UI','Noto Sans Bengali',system-ui,sans-serif;" +
        "box-shadow:0 2px 10px rgba(0,0,0,.35);max-width:min(78vw,440px)";
      (document.body || document.documentElement).appendChild(chip);
    }
    chip.textContent = msg;
    chip.style.display = "";
  }
  function chipHide() { if (chip) chip.style.display = "none"; }

  let lastOk = false;  // previous probe: logged in?
  let handled = false; // this 401→200 transition already handled
  let probing = false;

  async function probe() {
    if (probing) return;
    probing = true;
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) {
        // logged out — show the hint (this is where the 401 console lines come from)
        lastOk = false;
        handled = false;
        chipText(T[curLang()].hint);
        return;
      }
      const me = await res.json().catch(() => null);
      if (!me?.username) { lastOk = false; handled = false; return; }
      if (me.mustChangePassword) { chipHide(); return; } // forced-change modal owns the screen
      if (lastOk) { chipHide(); return; } // steady logged-in — nothing to do
      // fresh 401→200 transition = a login just succeeded
      handled = true;
      lastOk = true;
      chipText(T[curLang()].entering);
      setTimeout(() => {
        const pwVisible = !!document.querySelector('input[type="password"]');
        const addonModal = !!document.querySelector(".bca-overlay");
        if (pwVisible && !addonModal) location.reload(); // SPA missed it — enter for the user
        else chipHide();
      }, 2500);
    } catch { /* transient network hiccup */ }
    finally { probing = false; }
  }
  setInterval(probe, 1500);
  probe();
})();

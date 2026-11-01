// Hides the "Emoji set" (ইমোজি সেট) tab + panel in the main addon's admin
// panel, per owner request. Runs once on every app page load, follows the
// SPA around (React may re-render the panel), and is safe on any page.
// The real code in public/addons/addon.js is intentionally untouched.
(() => {
  "use strict";
  if (window.__bcaNoEmojiTab) return;
  window.__bcaNoEmojiTab = true;

  const hide = () => {
    document.querySelectorAll('.bca-tab[data-tab="symbols"]').forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll('.bca-tabpanel[data-panel="symbols"]').forEach((el) => {
      el.hidden = true;
      el.style.display = "none";
    });
  };

  const mo = new MutationObserver(() => hide());
  const start = () => mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
  document.addEventListener("DOMContentLoaded", hide, { once: true });
  hide();
})();

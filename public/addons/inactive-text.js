/* Replaces the app's "নিষ্ক্রিয় ব্যবহারকারী" / "Inactive User" wording with
   the owner-approved text, everywhere the bundled React app renders it:
   the login error (client_error.inactive_user) and any user-list badges.
   The minified bundle must not be edited (project rule), so this filters
   text nodes in the DOM: any node whose text is EXACTLY the old wording is
   swapped for the new sentence — nothing else is touched, so names,
   messages and all other UI stay untouched. React re-renders are covered
   by a MutationObserver. Language follows the app (localStorage.langPref).
*/
(() => {
  "use strict";
  if (window.__bcaInactiveText) return;
  window.__bcaInactiveText = true;

  const OLD = {
    en: "Inactive User",
    bn: "নিষ্ক্রিয় ব্যবহারকারী",
    // defensive: trimmed/variant forms seen in older builds
    enAlt: ["Inactive user", "Inactive"],
  };
  const NEW = {
    en: "This account has not been approved yet. Please contact the admin for approval.",
    bn: "এই আইডি এখনো অনুমোদন করা হয়নি। অনুমোদনের জন্য এডমিনের সাথে যোগাযোগ করুন।",
  };
  const lang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");

  const exact = new Set([OLD.en, OLD.bn]);
  for (const s of OLD.enAlt) exact.add(s);
  // unicode-escaped / normalized variants collapse to the same trimmed text
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const oldNorm = new Set([...exact].map(norm));
  const newFor = () => NEW[lang()];

  function swap(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue) continue;
      if (oldNorm.has(norm(node.nodeValue))) hits.push(node);
    }
    for (const node of hits) node.nodeValue = newFor();
    return hits.length;
  }

  // 1) swap anything already on the page
  swap(document.body);

  // 2) keep watching — React renders this string on failed logins etc.
  const mo = new MutationObserver((muts) => {
    let touched = false;
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          if (swap(n) > 0) touched = true;
        } else if (n.nodeType === 3 && oldNorm.has(norm(n.nodeValue))) {
          n.nodeValue = newFor();
          touched = true;
        }
      }
    }
    if (touched) swap(document.body); // catch wrapper re-flows
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

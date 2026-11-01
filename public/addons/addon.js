/* Bird-chat addon layer.
   Runs alongside the bundled React app without touching it:
   1) forced password-change modal for the seeded default admin
   2) "copy all messages" button — lives in the navbar icon group
      (falls back to a floating button if the navbar isn't there);
      txt / html / json formats — html copies with the rich look intact
   3) notice marquee fix — duration computed from the real text width
   4) admin panel — toggles for the copy button + online-users-list
      visibility and per-user force-logout (kick); admins only
   All addon UI follows the app language: the React app stores "en"/"bn"
   (default "bn") in localStorage.langPref and updates it on every change.
*/
(() => {
  "use strict";
  if (window.__bcaAddon) return;
  window.__bcaAddon = true;

  // ---------- shared helpers ----------
  const root = () => {
    let el = document.getElementById("bca-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "bca-root";
      el.className = "bca-root";
      document.body.appendChild(el);
    }
    el.classList.toggle("bca-dark", isDark());
    return el;
  };
  const isDark = () => !!document.querySelector(".navbar.bg-dark");
  const t = (ms, fn) => setTimeout(fn, ms);

  // ---------- i18n ----------
  const curLang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");
  const S = () => STRINGS[curLang()];

  const STRINGS = {
    en: {
      menuCopy: "Copy all messages",
      fabLabel: "Copy all",
      close: "Close",
      pwdTitle: "Change your password",
      pwdSub: "For security, chat can't be used with the default password. Choose a new one.",
      curPwd: "Current password",
      newPwd: "New password (at least 6 characters)",
      newPwd2: "Repeat new password",
      changeBtn: "Change password",
      changingBtn: "Changing…",
      fillAll: "Please fill in all fields",
      minSix: "The new password must be at least 6 characters",
      notMatch: "The two new passwords don't match",
      pwdChanged: "✓ Password changed — welcome!",
      noServer: "Can't reach the server",
      genericErr: "Something went wrong, please try again",
      errors: {
        "client_error.wrong_password": "The current password is incorrect",
        "client_error.passwords_not_identical_error": "The passwords don't match",
        "client_error.invalid_error": "Invalid input",
        "client_error.too_large_error": "Too large",
        "client_error.too_many_attempts": "Too many attempts — try again in a while",
        "client_error.internal_error": "Server problem",
        "client_error.admin_only": "Only admins can copy right now",
        "client_error.not_exists_error": "User not found",
      },
      copyTitle: "Copy all messages",
      copySub: "The whole conversation — names, times and replies included",
      fmtTxt: "📝 Clean note (TXT)",
      fmtTxtDesc: "HTML stripped, ready for a notebook",
      fmtHtml: "🎨 As shown (HTML)",
      fmtHtmlDesc: "The exact chat look — loads the full history, then copies the real page",
      fmtJson: "🧾 Raw data (JSON)",
      fmtJsonDesc: "Full details incl. reactions and edits",
      copyBtn: "📋 Copy",
      dlBtn: "⬇ Download",
      copied: (f) => `✓ Copied (${f})`,
      copyFail: "Couldn't copy — try again",
      collecting: (n) => `⏳ ${n}`,
      noMessagesYet: "No messages on screen yet",
      dlStarted: "✓ Download started",
      dlFail: "Couldn't download",
      adminMenu: "Admin panel",
      adminTitle: "Admin panel",
      adminSub: "Feature visibility and user sessions",
      copyModeLabel: "Who can use the copy button?",
      copyModeAll: "Everyone",
      copyModeAdmin: "Admins only",
      onlineModeLabel: "Who sees the online-users list?",
      onlineModeShow: "Everyone",
      onlineModeAdmin: "Admins only",
      modeAll: "Everyone",
      modeAdmin: "Admins only",
      modeAdminOnly: "Admins only",
      modeSelected: "Selected users",
      pickerCopyTitle: "Users allowed to copy",
      pickerOnlineTitle: "Users allowed to see the list",
      pickerAttendanceTitle: "Users allowed to open the attendance page",
      pickerPlaceholder: "username",
      noSelectedUsers: "Nobody selected yet",
      removeUser: "Remove",
      tabPermissions: "Permissions",
      tabUsers: "Users",
      tabAttendance: "Attendance counter",
      attViewLabel: "Who may open the attendance page?",
      attLinkLabel: "Attendance link",
      attEditorLabel: "HTML code of the page",
      attHint: "This link opens ONLY the code you save here — the chat UI is not included. The code is stored in the settings gist, so it survives restarts and redeploys.",
      attSave: "Save code",
      attSaving: "Saving…",
      attRestore: "Restore starter page",
      attRestoreConfirm: "Replace the editor content with the starter page? Nothing is saved until you press Save code.",
      attRestoreHint: "Starter page loaded — press Save code to store it",
      attNoDefault: "No starter page available",
      attPrefillHint: "Starter page loaded — edit it and press Save code",
      sessionExpired: "Session expired — reload the page and log in again",
      tabSymbols: "Emoji set",
      symTitle: "Emoji / symbol set for the composer menu",
      symHint: "One entry per line — they appear in the chat composer's symbols menu. Click catalogue emojis to select/unselect, search, or add ANY emoji via the box below (system keyboard / paste).",
      symPickLabel: "Pick emojis (click = select, again = remove)",
      symSearch: "Search… (bn/en)",
      symAddLabel: "Any custom emoji / symbol / text",
      symAddHint: "Type or paste anything — e.g. 🙂, 🎉, or a Bengali phrase. WhatsApp-style: any emoji your keyboard can produce works.",
      symSave: "Save set",
      symDefaultSet: "Set to app default",
      symDefaultConfirm: "Replace the whole set with the app's default symbols? This saves immediately.",
      symCountSuffix: "items",
      symNoResults: "No emoji matched the search",
      reactMore: "More reactions",
      selectedCopied: "✓ Copied selection",
      reactFail: "Couldn't add the reaction — try again",
      attCopied: "✓ Link copied",
      attTooLarge: "The code is too large — shorten it a little",
      saved: "✓ Saved",
      usersTitle: "Logged-in users",
      badgeAdmin: "admin",
      badgeSuspended: "suspended",
      kickBtn: "Log out",
      kickConfirm: (n) => `Log out ${n} from all their devices?`,
      kicked: (n) => `✓ ${n} was logged out`,
      kickSelf: "You can't log yourself out here",
      noUsers: "No users found",
      noLoggedIn: "No logged-in users right now",
      fetchFail: "Couldn't load data",
    },
    bn: {
      menuCopy: "সব মেসেজ কপি করুন",
      fabLabel: "সব কপি",
      close: "বন্ধ করুন",
      pwdTitle: "পাসওয়ার্ড বদলে নিন",
      pwdSub: "নিরাপত্তার জন্য ডিফল্ট পাসওয়ার্ড দিয়ে চ্যাট ব্যবহার করা যাবে না। নতুন পাসওয়ার্ড দিন।",
      curPwd: "বর্তমান পাসওয়ার্ড",
      newPwd: "নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)",
      newPwd2: "নতুন পাসওয়ার্ড আবার",
      changeBtn: "পাসওয়ার্ড পরিবর্তন করুন",
      changingBtn: "পরিবর্তন হচ্ছে…",
      fillAll: "সব ঘর পূরণ করুন",
      minSix: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে",
      notMatch: "নতুন পাসওয়ার্ড দুটো মিলছে না",
      pwdChanged: "✓ পাসওয়ার্ড পরিবর্তন হয়েছে — স্বাগতম!",
      noServer: "সার্ভারে পৌঁছানো যাচ্ছে না",
      genericErr: "সমস্যা হয়েছে, আবার চেষ্টা করুন",
      errors: {
        "client_error.wrong_password": "বর্তমান পাসওয়ার্ড সঠিক নয়",
        "client_error.passwords_not_identical_error": "পাসওয়ার্ড দুটো মিলছে না",
        "client_error.invalid_error": "ইনপুট সঠিক নয়",
        "client_error.too_large_error": "খুব বড় হয়ে গেছে",
        "client_error.too_many_attempts": "অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন",
        "client_error.internal_error": "সার্ভারে সমস্যা হয়েছে",
        "client_error.admin_only": "এখন শুধু অ্যাডমিন কপি করতে পারবেন",
        "client_error.not_exists_error": "ইউজার পাওয়া যায়নি",
      },
      copyTitle: "সব মেসেজ কপি করুন",
      copySub: "পুরো কথোপকথন — নাম, সময় ও উত্তরসহ",
      fmtTxt: "📝 সুন্দর নোট (TXT)",
      fmtTxtDesc: "HTML বাদ, নোট-বুকে রাখার উপযোগী",
      fmtHtml: "🎨 যেমন দেখায় (HTML)",
      fmtHtmlDesc: "চ্যাটে ঠিক যেমন দেখায় — পুরো হিস্ট্রি লোড করে আসল পেজটাই কপি হয়",
      fmtJson: "🧾 কাঁচা ডেটা (JSON)",
      fmtJsonDesc: "রিঅ্যাকশন, সম্পাদনাসহ পূর্ণ তথ্য",
      copyBtn: "📋 কপি",
      dlBtn: "⬇ ডাউনলোড",
      copied: (f) => `✓ কপি হয়েছে (${f})`,
      copyFail: "কপি করা যায়নি — আবার চেষ্টা করুন",
      collecting: (n) => `⏳ ${n}`,
      noMessagesYet: "পর্দায় এখনো কোনো মেসেজ নেই",
      dlStarted: "✓ ডাউনলোড শুরু হয়েছে",
      dlFail: "ডাউনলোড করা যায়নি",
      adminMenu: "অ্যাডমিন প্যানেল",
      adminTitle: "অ্যাডমিন প্যানেল",
      adminSub: "ফিচার দেখানো-লুকানো ও ইউজার সেশন",
      copyModeLabel: "কপি বাটন কারা ব্যবহার করতে পারবে?",
      copyModeAll: "সবাই",
      copyModeAdmin: "শুধু অ্যাডমিন",
      onlineModeLabel: "অনলাইন ইউজারের তালিকা কারা দেখবে?",
      onlineModeShow: "সবাই",
      onlineModeAdmin: "শুধু অ্যাডমিন",
      modeAll: "সবাই",
      modeAdmin: "শুধু অ্যাডমিন",
      modeAdminOnly: "শুধু অ্যাডমিন",
      modeSelected: "নির্বাচিত ইউজার",
      pickerCopyTitle: "কারা কপি করতে পারবে",
      pickerOnlineTitle: "তালিকা কারা দেখতে পারবে",
      pickerAttendanceTitle: "কাজিরা পেজ কারা খুলতে পারবে",
      pickerPlaceholder: "ইউজারনেম",
      noSelectedUsers: "এখনো কাউকে বাছাই করা হয়নি",
      removeUser: "সরান",
      tabPermissions: "পারমিশন",
      tabUsers: "ইউজার",
      tabAttendance: "হাজিরা কাউন্টার",
      attViewLabel: "হাজিরা পেজ কারা খুলতে পারবে?",
      attLinkLabel: "হাজিরা লিংক",
      attEditorLabel: "পেজের HTML কোড",
      attHint: "এই লিংকে শুধু এখানে সেভ করা কোডটাই দেখা যাবে — চ্যাটের কিছুই থাকবে না। কোডটা সেটিংস গিস্টে সেভ হয়, তাই রিস্টার্ট বা রিডিপ্লয়েও থাকবে।",
      attSave: "কোড সেভ করুন",
      attSaving: "সেভ হচ্ছে…",
      attRestore: "শুরুর পেজ ফিরিয়ে আনুন",
      attRestoreConfirm: "এডিটরের লেখা শুরুর পেজ দিয়ে বদলে দেব? সেভ না করলে কিছুই বদলাবে না।",
      attRestoreHint: "শুরুর পেজ লোড হয়েছে — সেভ করতে ‘কোড সেভ করুন’ চাপুন",
      attNoDefault: "কোনো শুরুর পেজ পাওয়া যায়নি",
      attPrefillHint: "শুরুর পেজটা লোড হয়েছে — দরকারমতো বদলে ‘কোড সেভ করুন’ চাপুন",
      sessionExpired: "সেশন শেষ — পেজ রিলোড করে আবার লগইন করুন",
      tabSymbols: "ইমোজি সেট",
      symTitle: "কম্পোজার মেনুর ইমোজি / সিম্বল সেট",
      symHint: "প্রতি লাইনে একটি — চ্যাট কম্পোজারের সিম্বল-মেনুতে এগুলোই দেখা যায়। ক্যাটালগের ইমোজিতে ক্লিক করলে যোগ/বাদ হয়, সার্চ করা যায়, বা নিচের ঘরে যেকোনো ইমোজি দেওয়া যায়।",
      symPickLabel: "ইমোজি বাছুন (ক্লিক = যোগ, আবার ক্লিক = বাদ)",
      symSearch: "খুঁজুন… (বাং/ইং)",
      symAddLabel: "যেকোনো কাস্টম ইমোজি / সিম্বল / লেখা",
      symAddHint: "যা খুশি লিখুন বা পেস্ট করুন — যেমন 🙂, 🎉, বা বাংলা বাক্য। হোয়াটসঅ্যাপ-স্টাইলে কিবোর্ডে যে ইমোজি আছে সবই চলবে।",
      symSave: "সেট সেভ করুন",
      symDefaultSet: "অ্যাপের ডিফল্ট সেট করুন",
      symDefaultConfirm: "পুরো সেটটা অ্যাপের ডিফল্ট সিম্বল দিয়ে বদলে দেব? সাথে সাথে সেভ হবে।",
      symCountSuffix: "টি",
      symNoResults: "এই খোঁজে কোনো ইমোজি মেলেনি",
      reactMore: "আরও রিয়েকশন",
      selectedCopied: "✓ নির্বাচিত অংশ কপি হয়েছে",
      reactFail: "রিয়েকশন দেওয়া যায়নি — আবার চেষ্টা করুন",
      attCopied: "✓ লিংক কপি হয়েছে",
      attTooLarge: "কোডটা অনেক বড় — একটু ছোট করুন",
      saved: "✓ সেভ হয়েছে",
      usersTitle: "লগইন-করা ইউজার",
      badgeAdmin: "অ্যাডমিন",
      badgeSuspended: "বন্ধ",
      kickBtn: "লগআউট",
      kickConfirm: (n) => `নিশ্চিত? ${n} তার সব ডিভাইস থেকে লগআউট হয়ে যাবে।`,
      kicked: (n) => `✓ ${n} লগআউট করা হয়েছে`,
      kickSelf: "নিজেকে এখান থেকে লগআউট করা যাবে না",
      noUsers: "কোনো ইউজার নেই",
      noLoggedIn: "এই মুহূর্তে কোনো লগইন-করা ইউজার নেই",
      fetchFail: "তথ্য আনা যায়নি",
    },
  };

  const errText = (body) =>
    (body && (S().errors[body.message] || body.message)) || S().genericErr;

  function toast(message, isErr = false) {
    const host = root();
    host.querySelectorAll(".bca-toast").forEach((x) => x.remove());
    const el = document.createElement("div");
    el.className = "bca-toast" + (isErr ? " err" : "");
    el.textContent = message;
    host.appendChild(el);
    t(3200, () => el.remove());
  }

  async function fetchMe() {
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ---------- feature visibility (admin-configurable) ----------
  let meUser = null;
  /** resolved permissions come from the server: `canCopyAll` / `canSeeOnlineUsers`
      answer "may *I*, this user, do it?" — the selected-user lists never leave
      the admin API, so the addon never has to reproduce the rule */
  const DEFAULT_FEATURES = () => ({
    copyAllMode: "all",
    showOnlineUsers: "all",
    attendanceMode: "admin",
    canCopyAll: true,
    canSeeOnlineUsers: true,
    canViewAttendance: false,
    hasAttendanceHtml: false,
    supported: true,
  });
  let features = DEFAULT_FEATURES();

  const modeOf = (value, fallback) =>
    value === "admin" || value === "selected" ? value : value === "all" ? "all" : fallback;

  function applyVisibility(body, isAdmin) {
    if (!body || typeof body !== "object") return;
    features.copyAllMode = modeOf(body.copyAllMode, "all");
    features.showOnlineUsers = modeOf(body.showOnlineUsers, "all");
    features.attendanceMode = body.attendanceMode === "selected" ? "selected" : "admin";
    // an admin always keeps every feature — also true when talking to a server
    // that predates the boolean fields
    features.canCopyAll =
      typeof body.canCopyAll === "boolean" ? body.canCopyAll : features.copyAllMode === "all";
    features.canSeeOnlineUsers =
      typeof body.canSeeOnlineUsers === "boolean" ? body.canSeeOnlineUsers : features.showOnlineUsers === "all";
    features.canViewAttendance =
      typeof body.canViewAttendance === "boolean" ? body.canViewAttendance : !!isAdmin;
    features.hasAttendanceHtml = body.hasAttendanceHtml === true;
    features.supported = true;
  }

  async function refreshFeatures() {
    try {
      const res = await fetch("/api/chat/visibility", { credentials: "same-origin" });
      if (res.status === 404) {
        // backend without this endpoint (older build) — hide the admin panel
        // and the html format, keep the classic copy working
        features.supported = false;
        return;
      }
      if (!res.ok) return; // transient — keep the last known values
      applyVisibility(await res.json().catch(() => null), !!meUser?.isAdmin);
    } catch {
      /* transient — keep the last known values */
    }
  }
  const copyAllowed = () => !!(meUser && (meUser.isAdmin || features.canCopyAll));

  // ==================================================================
  // 1) forced password change (seeded default admin, first login)
  // ==================================================================
  function showForceChangeModal() {
    const s = S();
    const host = root();
    if (host.querySelector(".bca-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "bca-overlay";
    overlay.innerHTML = `
      <div class="bca-modal" role="dialog" aria-modal="true">
        <div class="bca-shield">🔐</div>
        <h2></h2>
        <p class="bca-sub"></p>
        <div class="bca-err"></div>
        <div class="bca-field">
          <label></label>
          <input type="password" name="cur" autocomplete="current-password" autofocus>
        </div>
        <div class="bca-field">
          <label></label>
          <input type="password" name="new1" autocomplete="new-password">
        </div>
        <div class="bca-field">
          <label></label>
          <input type="password" name="new2" autocomplete="new-password">
        </div>
        <button class="bca-btn" type="button"></button>
      </div>`;
    // text via textContent (strings contain no markup, but stay XSS-clean)
    overlay.querySelector("h2").textContent = s.pwdTitle;
    overlay.querySelector(".bca-sub").textContent = s.pwdSub;
    const labels = overlay.querySelectorAll(".bca-field label");
    labels[0].textContent = s.curPwd;
    labels[1].textContent = s.newPwd;
    labels[2].textContent = s.newPwd2;
    const btn = overlay.querySelector("button.bca-btn");
    btn.textContent = s.changeBtn;
    host.appendChild(overlay);

    const err = overlay.querySelector(".bca-err");
    const inputs = overlay.querySelectorAll("input");
    const fail = (msg) => { err.textContent = msg; err.classList.add("show"); };

    const submit = async () => {
      const [cur, n1, n2] = [...inputs].map((i) => i.value);
      err.classList.remove("show");
      if (!cur || !n1 || !n2) return fail(s.fillAll);
      if (n1.length < 6) return fail(s.minSix);
      if (n1 !== n2) return fail(s.notMatch);
      btn.disabled = true;
      btn.textContent = s.changingBtn;
      try {
        const res = await fetch("/api/changePassword", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: cur, password: n1 }),
        });
        const body = await res.json().catch(() => null);
        if (res.ok) {
          overlay.remove();
          toast(s.pwdChanged);
          t(600, () => location.reload());
        } else {
          fail(errText(body));
          btn.disabled = false;
          btn.textContent = s.changeBtn;
        }
      } catch {
        fail(s.noServer);
        btn.disabled = false;
        btn.textContent = s.changeBtn;
      }
    };
    btn.addEventListener("click", submit);
    overlay.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    t(50, () => inputs[0].focus());
  }

  // ==================================================================
  // 2) copy-all-messages button (navbar icon group) + popup
  // ==================================================================
  let outsideHandler = null;
  let escapeHandler = null;

  function closePopup() {
    root().querySelectorAll(".bca-popup").forEach((p) => p.remove());
    if (outsideHandler) { document.removeEventListener("click", outsideHandler); outsideHandler = null; }
    if (escapeHandler) { document.removeEventListener("keydown", escapeHandler); escapeHandler = null; }
  }

  function watchPopup(pop, openerSelector) {
    const closeBtn = pop.querySelector(".bca-close");
    closeBtn.title = S().close;
    closeBtn.setAttribute("aria-label", S().close);
    closeBtn.addEventListener("click", closePopup);
    outsideHandler = (e) => {
      if (!pop.contains(e.target) && !e.target.closest(openerSelector)) closePopup();
    };
    escapeHandler = (e) => { if (e.key === "Escape") closePopup(); };
    t(30, () => {
      document.addEventListener("click", outsideHandler);
      document.addEventListener("keydown", escapeHandler);
    });
  }

  // ---------- "as shown" HTML export: capture the real chat DOM ----------
  // no hand-made template — the live React nodes themselves are cloned, so the
  // copy looks exactly like the browser. Full history is loaded by auto-
  // scrolling to the top (the app fetches older pages while scrolling).
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

  function messageNodes() {
    return [...document.querySelectorAll('div[id^="message-"]')];
  }

  function findChatScroller() {
    let el = messageNodes()[0]?.parentElement;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 50) return el;
      el = el.parentElement;
    }
    return null;
  }

  function cleanMessageClone(node) {
    // keep the node EXACTLY as the browser renders it — the user pastes the
    // raw rendered html (position/top included); nothing is flattened here
    return node;
  }

  async function captureMessagesHtml(progress) {
    if (!messageNodes().length) throw new Error("no messages on screen");
    const scroller = findChatScroller();
    const seen = new Map(); // id -> clone (virtualization may unmount as we scroll)
    const grab = () => {
      for (const n of messageNodes()) {
        const id = parseInt(n.id.slice("message-".length), 10);
        if (Number.isFinite(id) && !seen.has(id)) seen.set(id, n.cloneNode(true));
      }
    };
    grab();
    const wasAt = scroller ? scroller.scrollTop : 0;
    if (scroller) {
      let stale = 0;
      let prev = seen.size;
      for (let i = 0; i < 400 && stale < 5; i++) {
        scroller.scrollTop = 0; // jumping to the top makes the app page in older history
        await sleepMs(320);
        grab();
        if (progress) progress(seen.size);
        if (seen.size === prev) stale++;
        else { stale = 0; prev = seen.size; }
      }
      scroller.scrollTop = scroller.scrollHeight; // back to the live bottom
      void wasAt;
    }
    // the copy IS the rendered fragments — byte-for-byte what the browser has,
    // one <div id="message-N">…</div> per message, joined in id order
    const parts = [];
    for (const id of [...seen.keys()].sort((a, b) => a - b)) {
      parts.push(cleanMessageClone(seen.get(id)).outerHTML);
    }
    return parts.join("");
  }

  function showExportPopup() {
    closePopup();
    const s = S();
    const host = root();
    const pop = document.createElement("div");
    pop.className = "bca-popup";
    pop.innerHTML = `
      <button class="bca-close" type="button">✕</button>
      <h3></h3>
      <p class="bca-sub"></p>
      <div class="bca-format">
        <label>
          <input type="radio" name="bca-fmt" value="txt" checked>
          <span><span class="bca-fmt-title"></span><br>
          <span class="bca-fmt-desc"></span></span>
        </label>
        <label class="bca-fmt-html">
          <input type="radio" name="bca-fmt" value="html">
          <span><span class="bca-fmt-title"></span><br>
          <span class="bca-fmt-desc"></span></span>
        </label>
        <label>
          <input type="radio" name="bca-fmt" value="json">
          <span><span class="bca-fmt-title"></span><br>
          <span class="bca-fmt-desc"></span></span>
        </label>
      </div>
      <div class="bca-actions">
        <button class="bca-btn" data-act="copy" type="button"></button>
        <button class="bca-btn ghost" data-act="download" type="button"></button>
      </div>`;
    pop.querySelector("h3").textContent = s.copyTitle;
    pop.querySelector(".bca-sub").textContent = s.copySub;
    const titles = pop.querySelectorAll(".bca-fmt-title");
    const descs = pop.querySelectorAll(".bca-fmt-desc");
    titles[0].textContent = s.fmtTxt;
    descs[0].textContent = s.fmtTxtDesc;
    titles[1].textContent = s.fmtHtml;
    descs[1].textContent = s.fmtHtmlDesc;
    titles[2].textContent = s.fmtJson;
    descs[2].textContent = s.fmtJsonDesc;
    if (!features.supported) pop.querySelector(".bca-fmt-html").style.display = "none";
    const buttons = pop.querySelectorAll(".bca-actions .bca-btn");
    buttons[0].textContent = s.copyBtn;
    buttons[1].textContent = s.dlBtn;
    host.appendChild(pop);
    watchPopup(pop, ".bca-fab, .bca-navcopy");

    const fmt = () => pop.querySelector("input[name=bca-fmt]:checked").value;

    const loadExport = async (format) => {
      const res = await fetch(`/api/chat/export?format=${format}&lang=${curLang()}`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw Object.assign(new Error("export failed"), { body });
      }
      return { format, text: await res.text() };
    };

    const writeRich = async (html, plain) => {
      // rich paste (Word, Mail, Notion, WhatsApp-web…): text/html flavor with
      // a text/plain twin; falls back to the html source as plain text
      const richSupported =
        window.ClipboardItem &&
        navigator.clipboard &&
        (!ClipboardItem.supports || ClipboardItem.supports("text/html"));
      if (richSupported) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        })]);
        return;
      }
      await writePlain(html);
    };

    const writePlain = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
    };

    const copy = async () => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        const format = fmt();
        if (format === "html") {
          const html = await captureMessagesHtml((n) => { buttons[0].textContent = s.collecting(n); });
          // both clipboard flavors carry the SAME raw fragments the download
          // saves — a paste target that prefers text/plain must not swap in
          // the txt note instead
          await writeRich(html, html);
        } else {
          const { text } = await loadExport(format);
          await writePlain(text);
        }
        closePopup();
        toast(s.copied(format.toUpperCase()));
      } catch (err) {
        toast(err?.body ? errText(err.body) : err?.message === "no messages on screen" ? s.noMessagesYet : s.copyFail, true);
      } finally {
        buttons[0].textContent = s.copyBtn;
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    const download = async () => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        const format = fmt();
        let text;
        if (format === "html") text = await captureMessagesHtml((n) => { buttons[1].textContent = s.collecting(n); });
        else text = (await loadExport(format)).text;
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const mime = format === "json" ? "application/json" : format === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
        const blob = new Blob([text], { type: mime });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `chat-export-${stamp}.${format}`;
        a.click();
        t(1500, () => URL.revokeObjectURL(a.href));
        closePopup();
        toast(s.dlStarted);
      } catch {
        toast(s.dlFail, true);
      } finally {
        buttons[1].textContent = s.dlBtn;
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    buttons[0].addEventListener("click", copy);
    buttons[1].addEventListener("click", download);
  }

  // ==================================================================
  // 2b) admin panel — three-mode feature permissions, the per-feature
  //     user picker, the attendance-counter editor, per-user force-logout
  // ==================================================================

  /** tick the radio matching `value` inside a mode segment */
  const checkRadio = (seg, value) => {
    if (!seg) return;
    const input = seg.querySelector(`input[value="${value}"]`);
    if (input) input.checked = true;
  };

  /** three-way permission control: everyone / admins only / hand-picked users */
  function modeSegment(name, labels) {
    const wrap = document.createElement("div");
    wrap.className = "bca-opts";
    for (const [value, label] of labels) {
      const lab = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = value;
      const span = document.createElement("span");
      span.textContent = label;
      lab.appendChild(input);
      lab.appendChild(span);
      wrap.appendChild(lab);
    }
    return wrap;
  }

  /**
   * Username picker: every account as a checkbox plus a free-text box for a
   * name that is not in the list yet (useful before the person registers).
   */
  function userPicker(title, placeholder, initial) {
    const s = S();
    const box = document.createElement("div");
    box.className = "bca-picker";
    const head = document.createElement("div");
    head.className = "bca-setting-label";
    head.textContent = title;
    box.appendChild(head);

    const chips = document.createElement("div");
    chips.className = "bca-chips";
    box.appendChild(chips);

    const entry = document.createElement("div");
    entry.className = "bca-picker-entry";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "bca-mini";
    addBtn.textContent = "+";
    entry.appendChild(input);
    entry.appendChild(addBtn);
    box.appendChild(entry);

    const list = document.createElement("div");
    list.className = "bca-picker-list";
    box.appendChild(list);

    const state = new Set(
      (Array.isArray(initial) ? initial : []).map((n) => String(n).trim()).filter(Boolean)
    );

    const handlers = [];
    const emit = () => handlers.forEach((fn) => fn());

    const renderChips = () => {
      chips.innerHTML = "";
      if (!state.size) {
        const none = document.createElement("span");
        none.className = "bca-chips-empty";
        none.textContent = s.noSelectedUsers;
        chips.appendChild(none);
        return;
      }
      for (const name of [...state]) {
        const chip = document.createElement("span");
        chip.className = "bca-chip";
        const label = document.createElement("span");
        label.textContent = name;
        const x = document.createElement("button");
        x.type = "button";
        x.className = "bca-chip-x";
        x.textContent = "✕";
        x.title = s.removeUser;
        x.setAttribute("aria-label", s.removeUser);
        x.addEventListener("click", () => {
          state.delete(name);
          renderChips();
          syncBoxes();
          emit();
        });
        chip.appendChild(label);
        chip.appendChild(x);
        chips.appendChild(chip);
      }
    };

    const boxes = new Map();
    const syncBoxes = () => {
      for (const [name, cb] of boxes) cb.checked = state.has(name);
    };

    const add = (raw) => {
      const name = String(raw || "").trim().slice(0, 50);
      if (!name) return;
      if ([...state].some((n) => n.toLowerCase() === name.toLowerCase())) return;
      state.add(name);
      input.value = "";
      renderChips();
      syncBoxes();
      emit();
    };

    addBtn.addEventListener("click", () => add(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add(input.value);
      }
    });

    // the account list needs the admin API; when it is unavailable the free
    // text box still lets the admin pick any username
    const loadAccounts = async () => {
      list.textContent = "…";
      try {
        const res = await fetch("/api/users", { credentials: "same-origin" });
        if (!res.ok) {
          list.textContent = "";
          return;
        }
        const users = await res.json();
        list.innerHTML = "";
        for (const u of Array.isArray(users) ? users : []) {
          const username = u.username || "";
          if (!username) continue;
          const lab = document.createElement("label");
          lab.className = "bca-picker-item";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = state.has(username);
          cb.addEventListener("change", () => {
            if (cb.checked) {
              state.add(username);
            } else {
              for (const n of [...state]) {
                if (n.toLowerCase() === username.toLowerCase()) state.delete(n);
              }
            }
            renderChips();
            emit();
          });
          boxes.set(username, cb);
          const span = document.createElement("span");
          span.textContent = username;
          lab.appendChild(cb);
          lab.appendChild(span);
          if (u.isAdmin) {
            const b = document.createElement("span");
            b.className = "bca-badge admin";
            b.textContent = s.badgeAdmin;
            lab.appendChild(b);
          }
          list.appendChild(lab);
        }
      } catch {
        list.textContent = "";
      }
    };

    renderChips();
    loadAccounts();

    return { el: box, values: () => [...state], onChange: (fn) => handlers.push(fn) };
  }

  async function showAdminPanel() {
    closePopup();
    const s = S();
    const host = root();
    const pop = document.createElement("div");
    pop.className = "bca-popup bca-admin";
    pop.innerHTML = `
      <button class="bca-close" type="button">✕</button>
      <h3></h3>
      <p class="bca-sub"></p>
      <div class="bca-tabs" role="tablist">
        <button type="button" class="bca-tab on" data-tab="perm"></button>
        <button type="button" class="bca-tab" data-tab="users"></button>
        <button type="button" class="bca-tab" data-tab="attendance"></button>
        <button type="button" class="bca-tab" data-tab="symbols"></button>
      </div>
      <div class="bca-tabpanel" data-panel="perm"></div>
      <div class="bca-tabpanel" data-panel="users" hidden></div>
      <div class="bca-tabpanel" data-panel="attendance" hidden></div>
      <div class="bca-tabpanel" data-panel="symbols" hidden></div>`;
    pop.querySelector("h3").textContent = s.adminTitle;
    pop.querySelector(".bca-sub").textContent = s.adminSub;
    const tabLabels = [s.tabPermissions, s.tabUsers, s.tabAttendance, s.tabSymbols];
    pop.querySelectorAll(".bca-tab").forEach((tab, i) => (tab.textContent = tabLabels[i]));
    host.appendChild(pop);
    watchPopup(pop, ".bca-navadmin");

    const permPane = pop.querySelector('[data-panel="perm"]');
    const usersPane = pop.querySelector('[data-panel="users"]');
    const attendancePane = pop.querySelector('[data-panel="attendance"]');
    const symbolsPane = pop.querySelector('[data-panel="symbols"]');

    pop.querySelectorAll(".bca-tab").forEach((tab) =>
      tab.addEventListener("click", () => {
        pop.querySelectorAll(".bca-tab").forEach((x) => x.classList.toggle("on", x === tab));
        pop.querySelectorAll(".bca-tabpanel").forEach((pane) => {
          pane.hidden = pane.dataset.panel !== tab.dataset.tab;
        });
      })
    );

    // every pane is built up-front — the attendance editor loads its own
    // document, so it is ready the moment the tab is opened
    buildAttendancePane(attendancePane);
    buildSymbolsPane(symbolsPane);

    // ---------- shared save ----------
    const applyServerState = (next) => {
      if (!next || typeof next !== "object") return;
      features.copyAllMode =
        next.copyAllMode === "admin" ? "admin" : next.copyAllMode === "selected" ? "selected" : "all";
      features.showOnlineUsers =
        next.showOnlineUsers === "admin" ? "admin" : next.showOnlineUsers === "selected" ? "selected" : "all";
      features.attendanceMode = next.attendanceMode === "selected" ? "selected" : "admin";
      if (typeof next.canCopyAll === "boolean") features.canCopyAll = next.canCopyAll;
      if (typeof next.canSeeOnlineUsers === "boolean") features.canSeeOnlineUsers = next.canSeeOnlineUsers;
      if (typeof next.canViewAttendance === "boolean") features.canViewAttendance = next.canViewAttendance;
      if (typeof next.hasAttendanceHtml === "boolean") features.hasAttendanceHtml = next.hasAttendanceHtml;
      features.supported = true;
    };

    const save = async (body, onFail) => {
      try {
        const res = await fetch("/api/chat/admin-settings", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("save failed");
        applyServerState(await res.json().catch(() => null));
        ensureNavButtons();
        applyUsersPanelVisibility();
        toast(s.saved);
        return true;
      } catch {
        if (onFail) onFail();
        toast(s.fetchFail, true);
        return false;
      }
    };

    /** one feature block: label + three-mode segment (+ optional user picker) */
    const featureBlock = (labelText, segName, mode, picker) => {
      const wrap = document.createElement("div");
      wrap.className = "bca-setting";
      const label = document.createElement("div");
      label.className = "bca-setting-label";
      label.textContent = labelText;
      const seg = modeSegment(segName, [
        ["all", s.modeAll],
        ["admin", s.modeAdmin],
        ["selected", s.modeSelected],
      ]);
      wrap.appendChild(label);
      wrap.appendChild(seg);
      if (picker) wrap.appendChild(picker.el);
      permPane.appendChild(wrap);
      return seg;
    };

    // the selected-user lists stay behind the admin API — load them so the
    // pickers show the current selections on every device
    let lists = null;
    try {
      const res = await fetch("/api/chat/admin-settings", { credentials: "same-origin" });
      if (res.ok) lists = await res.json().catch(() => null);
    } catch { /* fall back to the resolved visibility values */ }

    const copyMode = lists?.copyAllMode || features.copyAllMode;
    const onlineMode = lists?.showOnlineUsers || features.showOnlineUsers;
    const copyPicker = userPicker(s.pickerCopyTitle, s.pickerPlaceholder, lists?.copyAllSelected || []);
    const copySeg = featureBlock(s.copyModeLabel, "bca-copymode", copyMode, copyPicker);

    const onlinePicker = userPicker(s.pickerOnlineTitle, s.pickerPlaceholder, lists?.onlineUsersSelected || []);
    const onlineSeg = featureBlock(s.onlineModeLabel, "bca-online", onlineMode, onlinePicker);

    checkRadio(copySeg, copyMode);
    checkRadio(onlineSeg, onlineMode);

    copySeg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        save({ copyAllMode: input.value, copyAllSelected: copyPicker.values() }, () =>
          checkRadio(copySeg, features.copyAllMode)
        )
      )
    );
    onlineSeg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        save({ showOnlineUsers: input.value, onlineUsersSelected: onlinePicker.values() }, () =>
          checkRadio(onlineSeg, features.showOnlineUsers)
        )
      )
    );
    copyPicker.onChange(() => save({ copyAllSelected: copyPicker.values() }));
    onlinePicker.onChange(() => save({ onlineUsersSelected: onlinePicker.values() }));

    // ---------- users tab: force-logout ----------
    usersPane.innerHTML = `
      <div class="bca-users">
        <div class="bca-setting-label"></div>
        <div class="bca-userlist"><div class="bca-userlist-note"></div></div>
      </div>`;
    usersPane.querySelector(".bca-setting-label").textContent = s.usersTitle;
    const list = usersPane.querySelector(".bca-userlist");
    const note = (msg) => {
      list.innerHTML = "";
      const d = document.createElement("div");
      d.className = "bca-userlist-note";
      d.textContent = msg;
      list.appendChild(d);
    };

    const kick = async (username, btn) => {
      if (!window.confirm(s.kickConfirm(username))) return;
      btn.disabled = true;
      try {
        const res = await fetch("/api/users/kick", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast(errText(body), true);
        } else {
          toast(s.kicked(username));
          loadUsers();
        }
      } catch {
        toast(s.fetchFail, true);
      } finally {
        btn.disabled = false;
      }
    };

    async function loadUsers() {
      note("…");
      try {
        const res = await fetch("/api/users", { credentials: "same-origin" });
        if (!res.ok) return note(s.fetchFail);
        const users = await res.json();
        if (!Array.isArray(users) || users.length === 0) return note(s.noUsers);
        // kicking only makes sense for users who are actually logged in —
        // servers that don't flag sessions yet (old build) fall back to showing all
        const hasFlag = users.some((u) => typeof u.loggedIn === "boolean");
        const shown = hasFlag ? users.filter((u) => u.loggedIn) : users;
        if (shown.length === 0) return note(s.noLoggedIn);
        list.innerHTML = "";
        for (const u of shown) {
          const row = document.createElement("div");
          row.className = "bca-user";
          const name = document.createElement("span");
          name.className = "bca-user-name";
          name.textContent = u.username || "?";
          row.appendChild(name);
          if (u.isAdmin) {
            const b = document.createElement("span");
            b.className = "bca-badge admin";
            b.textContent = s.badgeAdmin;
            row.appendChild(b);
          }
          if (u.active === false) {
            const b = document.createElement("span");
            b.className = "bca-badge suspended";
            b.textContent = s.badgeSuspended;
            row.appendChild(b);
          }
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "bca-kick";
          btn.textContent = s.kickBtn;
          const self = (u.username || "").toLowerCase() === (meUser?.username || "").toLowerCase();
          if (self) {
            btn.disabled = true;
            btn.title = s.kickSelf;
          } else {
            btn.addEventListener("click", () => kick(u.username, btn));
          }
          row.appendChild(btn);
          list.appendChild(row);
        }
      } catch {
        note(s.fetchFail);
      }
    }
    loadUsers();

  }

  /** attendance-counter section: view permissions, the link, the html editor */
  function buildAttendancePane(pane) {
    const s = S();
    pane.innerHTML = `
      <div class="bca-setting">
        <div class="bca-setting-label bca-att-view-label"></div>
        <div class="bca-opts-slot"></div>
        <div class="bca-picker-slot"></div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-att-link-label"></div>
        <div class="bca-linkrow">
          <a class="bca-att-link" target="_blank" rel="noopener"></a>
          <button type="button" class="bca-mini bca-copy-link"></button>
        </div>
        <div class="bca-hint bca-att-note"></div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-att-editor-label"></div>
        <textarea class="bca-editor" spellcheck="false" wrap="off"></textarea>
        <div class="bca-editor-bar">
          <span class="bca-editor-count"></span>
          <span class="bca-editor-msg"></span>
          <button type="button" class="bca-btn bca-att-save"></button>
          <button type="button" class="bca-mini bca-att-default"></button>
        </div>
      </div>`;

    pane.querySelector(".bca-att-view-label").textContent = s.attViewLabel;
    pane.querySelector(".bca-att-link-label").textContent = s.attLinkLabel;
    pane.querySelector(".bca-att-editor-label").textContent = s.attEditorLabel;
    const noteEl = pane.querySelector(".bca-att-note");
    noteEl.textContent = s.attHint;

    const url = location.origin + "/attendance";
    const link = pane.querySelector(".bca-att-link");
    link.href = "/attendance";
    link.textContent = url;
    const copyLink = pane.querySelector(".bca-copy-link");
    copyLink.textContent = s.attCopyLink;

    const saveBtn = pane.querySelector(".bca-att-save");
    saveBtn.textContent = s.attSave;
    const defBtn = pane.querySelector(".bca-att-default");
    defBtn.textContent = s.attRestore;
    const editor = pane.querySelector(".bca-editor");
    const count = pane.querySelector(".bca-editor-count");
    const msg = pane.querySelector(".bca-editor-msg");

    let defaultHtml = "";
    let limit = 300000;

    const seg = modeSegment("bca-attmode", [
      ["admin", s.modeAdminOnly],
      ["selected", s.modeSelected],
    ]);
    pane.querySelector(".bca-opts-slot").appendChild(seg);

    const picker = userPicker(s.pickerAttendanceTitle, s.pickerPlaceholder, features.attendanceSelected || []);
    pane.querySelector(".bca-picker-slot").appendChild(picker.el);

    const paintCount = () => {
      count.textContent = `${editor.value.length.toLocaleString()} / ${limit.toLocaleString()}`;
      count.classList.toggle("over", editor.value.length > limit);
    };
    editor.addEventListener("input", () => {
      paintCount();
      msg.textContent = "";
    });

    const fill = (data) => {
      if (!data || typeof data !== "object") return;
      features.attendanceMode = data.attendanceViewMode === "selected" ? "selected" : "admin";
      features.attendanceSelected = Array.isArray(data.attendanceSelected) ? data.attendanceSelected : [];
      features.supported = true;
      checkRadio(seg, features.attendanceMode);
      defaultHtml = typeof data.defaultHtml === "string" ? data.defaultHtml : "";
      limit = Number(data.limit) > 0 ? Number(data.limit) : limit;
      const saved = typeof data.attendanceHtml === "string" ? data.attendanceHtml : "";
      // a fresh store used to show a BLANK box — prefill with the built-in
      // starter page so the admin always sees the code they are about to save
      editor.value = saved || defaultHtml;
      msg.textContent = !saved && defaultHtml ? s.attPrefillHint : "";
      paintCount();
    };

    const savePermissions = async (body) => {
      try {
        const res = await fetch("/api/chat/admin-settings", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("save failed");
        const next = await res.json().catch(() => null);
        if (next) {
          features.attendanceMode = next.attendanceMode === "selected" ? "selected" : "admin";
          if (typeof next.canViewAttendance === "boolean") features.canViewAttendance = next.canViewAttendance;
        }
        toast(s.saved);
      } catch {
        toast(s.fetchFail, true);
      }
    };

    seg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        savePermissions({ attendanceViewMode: input.value, attendanceSelected: picker.values() })
      )
    );
    picker.onChange(() => savePermissions({ attendanceSelected: picker.values() }));

    copyLink.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast(s.attCopied);
      } catch {
        toast(url);
      }
    });

    saveBtn.addEventListener("click", () => saveNow());

    async function saveNow() {
      if (editor.value.length > limit) {
        msg.textContent = s.attTooLarge;
        return;
      }
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = s.attSaving;
      msg.textContent = "";
      try {
        const res = await fetch("/api/chat/attendance", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceHtml: editor.value }),
        });
        if (res.status === 401) {
          // session died (server restart / 10h expiry) — say what actually happened
          msg.textContent = s.sessionExpired;
          toast(s.sessionExpired, true);
        } else if (!res.ok) {
          const body = await res.json().catch(() => null);
          msg.textContent = body?.errorMessage ? errText(body) : s.fetchFail;
          toast(s.fetchFail, true);
        } else {
          const data = await res.json().catch(() => null);
          // the save itself already succeeded — a fill hiccup must NOT show
          // "can't reach the server" over a 200 response
          try { fill(data); } catch (err) { console.error("attendance fill failed", err); }
          msg.textContent = s.saved;
          toast(s.saved);
        }
      } catch {
        msg.textContent = s.noServer;
        toast(s.noServer, true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
    };

    defBtn.addEventListener("click", async () => {
      if (!defaultHtml) return toast(s.attNoDefault, true);
      if (!window.confirm(s.attRestoreConfirm)) return;
      editor.value = defaultHtml;
      paintCount();
      await saveNow(); // restore = replace AND save, so the page actually reverts
    });

    // load the current document
    (async () => {
      try {
        const res = await fetch("/api/chat/attendance", { credentials: "same-origin" });
        if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          return;
        }
        if (!res.ok) return;
        fill(await res.json());
      } catch {
        /* transient — the editor simply stays empty */
      }
    })();
  }

  // ---------- navbar icons  }

  // ==================================================================
  // 2d) emoji / symbol set — the app renders one entry per line in the
  //     composer's "frequently used symbols" menu; this pane edits that
  //     exact document (text emojis, unicode, Bengali tags AND raw html)
  // ==================================================================
  // WhatsApp/Messenger-style catalogue — categories mirror the big pickers,
  // each entry is [name for search, emoji]. Names are bn+en so search works
  // in both app languages.
  const EMOJI_CATEGORIES = [
    {
      key: "smileys", label: { en: "Smileys", bn: "মুখ" }, icon: "😀",
      items: [
        ["হাসি smile", "😀"], ["দাঁতহাসি grin", "😁"], ["হাসি-কান্না lol", "😂"], ["মেঝেতে-গড়া rofl", "🤣"],
        ["হাসি smile", "😊"], ["চোখ-ঝলক-ish", "😍"], ["চুম্বন kiss", "😘"], ["সামান্য-হাসি slight", "🙂"],
        ["ঠোঁট-কামড় wink", "😉"], ["সানগ্লাস cool", "😎"], ["তারা-চোখ star", "🤩"], ["পার্টি party", "🥳"],
        ["কান্না cry", "😢"], ["ঝরে-কাঁদা sob", "😭"], ["রাগ angry", "😡"], ["ভাবুন think", "🤔"],
        ["জড়িয়ে hug", "🤗"], ["শ্রদ্ধা pray", "🙏"], ["থামুন stop", "🤚"], ["আশীর্বাদ bless", "🫱"],
        ["শান্ত relieved", "😌"], ["ঘুম sleepy", "😴"], ["অসুস্থ sick", "🤒"], ["মাথা-ঘোরা dizzy", "😵"],
        ["ঠান্ডা cold", "🥶"], ["গরম hot", "🥵"], ["নাকি-মাস্ক mask", "🤥"], ["সন্দেহ smirk", "😏"],
        ["নির্বোধ silly", "🤪"], ["চমৎকার zany", "🤯"], ["ভয় fear", "😨"], ["কাঁপা shiver", "😰"],
      ],
    },
    {
      key: "gestures", label: { en: "Gestures", bn: "হাত" }, icon: "👍",
      items: [
        ["থাম্ব-উপর like", "👍"], ["থাম্ব-নিচ dislike", "👎"], ["করতালি clap", "👏"], ["উৎসব hands", "🙌"],
        ["শক্তি muscle", "💪"], ["হ্যান্ডশেক deal", "🤝"], ["ওকে-হাত ok", "👌"], ["বিজয় peace", "✌️"],
        ["আঙুল-কাটা crossed", "🤞"], ["তর্কসাপেক্ষে ok", "🤙"], ["নমস্কার wave", "👋"], ["তালি-হাত raised", "🖐"],
        ["ইশারা point-right", "👉"], ["ইশারা point-left", "👈"], ["ইশারা point-up", "👆"], ["ইশারা point-down", "👇"],
        ["হাত-উঠানো hand", "✋"], ["দুই-হাত hands", "🤲"], ["হাত-জোড়া fold", "🙏"], ["লেখা write", "✍️"],
      ],
    },
    {
      key: "hearts", label: { en: "Hearts", bn: "হৃদয়" }, icon: "❤️",
      items: [
        ["লাল-হৃদয় love", "❤️"], ["কমলা heart", "🧡"], ["হলুদ heart", "💛"], ["সবুজ heart", "💚"],
        ["নীল heart", "💙"], ["বেগুনি heart", "💜"], ["কালো heart", "🖤"], ["সাদা heart", "🤍"],
        ["ভাঙা heart", "💔"], ["চুম্বন kiss", "💌"], ["ফুল flower", "🌹"], ["গোলাপ rose", "🌸"],
        ["তারা star", "⭐"], ["ঝলক sparkle", "✨"], ["উজ্জ্বল glow", "🌟"], ["আগুন fire", "🔥"],
      ],
    },
    {
      key: "objects", label: { en: "Objects", bn: "জিনিস" }, icon: "🎉",
      items: [
        ["উৎসব party", "🎉"], ["কনফেটি confetti", "🎊"], ["উপহার gift", "🎁"], ["ট্রফি trophy", "🏆"],
        ["পদক medal", "🥇"], ["ফুটবল football", "⚽"], ["ক্রিকেট cricket", "🏏"], ["ব্যাট bat", "🥎"],
        ["চা tea", "☕"], ["চা-গ্লাস cup", "🍵"], ["খাবার food", "🍚"], ["মিষ্টি sweet", "🍰"],
        ["কলম pen", "📝"], ["মেমো note", "📋"], ["স্টাডি study", "📚"], ["চিঠি mail", "✉️"],
        ["ঘণ্টা bell", "🔔"], ["ক্যামেরা camera", "📷"], ["মোবাইল phone", "📱"], ["কম্পিউটার pc", "💻"],
      ],
    },
    {
      key: "symbols", label: { en: "Symbols", bn: "চিহ্ন" }, icon: "✅",
      items: [
        ["সঠিক check", "✅"], ["ভুল cross", "❌"], ["প্রশ্ন question", "❓"], ["বিস্ময় bang", "❗"],
        ["সতর্কতা warn", "⚠️"], ["লাল red", "🔴"], ["সবুজ green", "🟢"], ["নীল blue", "🔵"],
        ["হলুদ yellow", "🟡"], ["বাদামি brown", "🟤"], ["বৃত্ত circle", "⭕"], ["হীরা diamond", "💠"],
        ["মোজাইক mosaic", "⛎"], ["তীর arrow", "➡️"], ["ফেরত back", "🔙"], ["উপরে top", "🔝"],
        ["লক lock", "🔒"], ["চাবি key", "🔑"], ["হাতুড়ি tool", "🔨"], ["বৈদ্যুতিক zap", "⚡"],
      ],
    },
    {
      key: "nature", label: { en: "Nature", bn: "প্রকৃতি" }, icon: "🌸",
      items: [
        ["সূর্য sun", "☀️"], ["চাঁদ moon", "🌙"], ["তারা-রাত night", "🌃"], ["মেঘ cloud", "☁️"],
        ["বৃষ্টি rain", "🌧"], ["তুষার snow", "❄️"], ["গাছ tree", "🌳"], ["পাতা leaf", "🍃"],
        ["ফুল-বাগান blossom", "🌺"], ["সূর্যমুখী sunflower", "🌻"], ["নদী river", "🏞"], ["সমুদ্র sea", "🌊"],
        ["পাখি bird", "🐦"], ["মৌমাছি bee", "🐝"], ["প্রজাপতি butterfly", "🦋"], ["বিড়াল cat", "🐱"],
        ["কুকুর dog", "🐶"], ["গরু cow", "🐮"], ["মুরগি hen", "🐔"], ["মাছ fish", "🐟"],
      ],
    },
  ];

  function buildSymbolsPane(pane) {
    const s = S();
    pane.innerHTML = `
      <div class="bca-setting">
        <div class="bca-setting-label bca-sym-title"></div>
        <div class="bca-hint bca-sym-hint"></div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-sym-pick-label"></div>
        <input type="text" class="bca-emoji-search" />
        <div class="bca-emoji-cats"></div>
        <div class="bca-emoji-grid"></div>
      </div>
      <div class="bca-setting">
        <textarea class="bca-editor bca-sym-editor" spellcheck="false" rows="9"></textarea>
        <div class="bca-editor-bar">
          <span class="bca-editor-count bca-sym-count"></span>
          <span class="bca-editor-msg bca-sym-msg"></span>
          <button type="button" class="bca-btn bca-sym-save"></button>
          <button type="button" class="bca-mini bca-sym-default"></button>
        </div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-sym-add-label"></div>
        <div class="bca-picker-entry">
          <input type="text" class="bca-sym-input" maxlength="200" />
          <button type="button" class="bca-mini bca-sym-add">+</button>
        </div>
        <div class="bca-hint bca-sym-add-hint"></div>
      </div>`;

    pane.querySelector(".bca-sym-title").textContent = s.symTitle;
    pane.querySelector(".bca-sym-hint").textContent = s.symHint;
    pane.querySelector(".bca-sym-pick-label").textContent = s.symPickLabel;
    const search = pane.querySelector(".bca-emoji-search");
    search.placeholder = s.symSearch;
    pane.querySelector(".bca-sym-add-label").textContent = s.symAddLabel;
    pane.querySelector(".bca-sym-add-hint").textContent = s.symAddHint;

    const editor = pane.querySelector(".bca-sym-editor");
    const count = pane.querySelector(".bca-sym-count");
    const msg = pane.querySelector(".bca-sym-msg");
    const saveBtn = pane.querySelector(".bca-sym-save");
    const defBtn = pane.querySelector(".bca-sym-default");
    const input = pane.querySelector(".bca-sym-input");
    const addBtn = pane.querySelector(".bca-sym-add");
    saveBtn.textContent = s.symSave;
    defBtn.textContent = s.symDefaultSet;

    let limit = 20000;
    let activeCat = EMOJI_CATEGORIES[0].key;

    // ---------- the list (editor) is the source of truth ----------
    const lineSet = () => new Set(editor.value.split("\n").map((l) => l.trim()).filter(Boolean));
    const paint = () => {
      const n = editor.value.split("\n").filter((l) => l.trim()).length;
      count.textContent = `${editor.value.length.toLocaleString()} / ${limit.toLocaleString()} · ${n} ${s.symCountSuffix}`;
      count.classList.toggle("over", editor.value.length > limit);
      // sync the picker highlight with the list
      const present = lineSet();
      grid.querySelectorAll(".bca-emoji").forEach((b) => {
        b.classList.toggle("on", present.has(b.dataset.emoji));
      });
    };
    editor.addEventListener("input", () => {
      paint();
      msg.textContent = "";
    });

    const append = (text) => {
      const value = String(text || "").trim();
      if (!value) return;
      const current = editor.value.replace(/\s+$/, "");
      editor.value = (current ? current + "\n" : "") + value;
      paint();
      msg.textContent = "";
    };

    // ---------- category tabs + grid (WhatsApp-style) ----------
    const cats = pane.querySelector(".bca-emoji-cats");
    const grid = pane.querySelector(".bca-emoji-grid");

    for (const cat of EMOJI_CATEGORIES) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "bca-emoji-cat" + (cat.key === activeCat ? " on" : "");
      tab.textContent = cat.icon;
      tab.title = cat.label[curLang()];
      tab.addEventListener("click", () => {
        activeCat = cat.key;
        cats.querySelectorAll(".bca-emoji-cat").forEach((x) => x.classList.toggle("on", x === tab));
        renderGrid();
      });
      cats.appendChild(tab);
    }

    function renderGrid() {
      grid.innerHTML = "";
      const q = search.value.trim().toLowerCase();
      const catsToScan = q
        ? EMOJI_CATEGORIES // search spans every category
        : EMOJI_CATEGORIES.filter((c) => c.key === activeCat);
      let shown = 0;
      for (const cat of catsToScan) {
        for (const [name, emoji] of cat.items) {
          if (q && !(name.toLowerCase().includes(q) || emoji.includes(q))) continue;
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bca-emoji";
          b.dataset.emoji = emoji;
          b.textContent = emoji;
          b.title = name;
          b.addEventListener("click", () => {
            // toggle: click adds the emoji to the list, clicking a selected
            // one removes it — exactly the "select defaults" flow
            const present = lineSet();
            if (present.has(emoji)) {
              const kept = editor.value.split("\n").filter((l) => l.trim() !== emoji);
              editor.value = kept.join("\n");
            } else {
              append(emoji);
            }
            paint();
          });
          grid.appendChild(b);
          shown++;
        }
      }
      if (!shown) {
        const none = document.createElement("div");
        none.className = "bca-chips-empty";
        none.textContent = s.symNoResults;
        grid.appendChild(none);
      }
      paint();
    }
    search.addEventListener("input", renderGrid);
    renderGrid();

    // ---------- free-form entry: ANY emoji from the system keyboard ----------
    addBtn.addEventListener("click", () => {
      append(input.value);
      input.value = "";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      append(input.value);
      input.value = "";
    });

    const fill = (data) => {
      if (!data || typeof data !== "object") return;
      limit = Number(data.limit) > 0 ? Number(data.limit) : limit;
      const saved = typeof data.frequentSymbols === "string" ? data.frequentSymbols : "";
      editor.value = saved;
      paint();
    };

    async function saveNow() {
      if (editor.value.length > limit) {
        msg.textContent = s.attTooLarge;
        return false;
      }
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = s.attSaving;
      msg.textContent = "";
      try {
        const res = await fetch("/api/chat/saveFrequentSymbols", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frequentSymbols: editor.value }),
        });
        if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          toast(s.sessionExpired, true);
        } else if (!res.ok) {
          msg.textContent = s.fetchFail;
          toast(s.fetchFail, true);
        } else {
          msg.textContent = s.saved;
          toast(s.saved);
          return true;
        }
      } catch {
        msg.textContent = s.noServer;
        toast(s.noServer, true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
      return false;
    }
    saveBtn.addEventListener("click", () => saveNow());

    // "অ্যাপের ডিফল্ট সেট করুন" — the server resets to its built-in list
    defBtn.addEventListener("click", async () => {
      if (!window.confirm(s.symDefaultConfirm)) return;
      defBtn.disabled = true;
      try {
        const res = await fetch("/api/chat/restoreFrequentSymbols", {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.ok) {
          const fresh = await fetch("/api/chat/getFrequentSymbols", { credentials: "same-origin" });
          if (fresh.ok) fill(await fresh.json());
          msg.textContent = s.saved;
          toast(s.saved);
        } else if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          toast(s.sessionExpired, true);
        } else {
          msg.textContent = s.fetchFail;
          toast(s.fetchFail, true);
        }
      } catch {
        msg.textContent = s.noServer;
        toast(s.noServer, true);
      } finally {
        defBtn.disabled = false;
      }
    });

    (async () => {
      try {
        const res = await fetch("/api/chat/getFrequentSymbols", { credentials: "same-origin" });
        if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          return;
        }
        if (!res.ok) return;
        fill(await res.json());
      } catch {
        /* transient */
      }
    })();
  }

  // ==================================================================
  // 2e) custom reactions: a "+" at the far right of the app's quick-reaction
  //     row opens a full picker; selecting an emoji reacts on that message
  //     via the addon's own socket.io connection (same session cookie).
  //     The official client is loaded from /socket.io/socket.io.js because
  //     the minified app does not expose its `io` globally.
  // ==================================================================
  let reactionSock = null;
  let reactionSockReady = null;
  let socketClientLoading = null;
  let reactionOutside = null;

  function loadSocketClient() {
    if (window.io) return Promise.resolve(window.io);
    if (socketClientLoading) return socketClientLoading;
    socketClientLoading = new Promise((resolve) => {
      const sc = document.createElement("script");
      sc.src = "/socket.io/socket.io.js";
      sc.onload = () => resolve(window.io || null);
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
    });
    return socketClientLoading;
  }

  async function reactionSocket() {
    const IO = await loadSocketClient();
    if (!IO) return null;
    if (reactionSockReady) return reactionSockReady;
    reactionSockReady = new Promise((resolve) => {
      try {
        reactionSock = IO({ transports: ["websocket", "polling"], reconnection: true });
        reactionSock.on("connect", () => resolve(reactionSock));
        reactionSock.on("connect_error", () => { /* socket.io retries */ });
        // don't hang the picker forever if the socket never connects
        t(8000, () => resolve(reactionSock?.connected ? reactionSock : null));
      } catch {
        resolve(null);
      }
    });
    return reactionSockReady;
  }

  /** the message model keeps reactions as { "<emoji>": { usernames: [] } } */
  function toggleReactionPayload(msgReactions, emoji, username) {
    const reactions = {};
    for (const key of Object.keys(msgReactions || {})) {
      reactions[key] = { usernames: [...(msgReactions[key]?.usernames || [])] };
    }
    const list = reactions[emoji]?.usernames || [];
    const mine = list.find((u) => u === username);
    if (mine) {
      reactions[emoji].usernames = list.filter((u) => u !== username);
    } else {
      reactions[emoji] = { usernames: [...list, username] };
    }
    return reactions;
  }

  /** read the reaction state from the bubble's own DOM (truth on screen) */
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

  async function reactOnMessage(bubble, emoji) {
    const id = parseInt(String(bubble.id || "").replace("message-", ""), 10);
    if (!Number.isFinite(id)) return;
    const username = meUser?.username;
    if (!username) return;
    const s = S();
    const sock = await reactionSocket();
    if (!sock) return toast(s.reactFail, true);
    const reactions = toggleReactionPayload(readReactionsFromDom(bubble), emoji, username);
    sock.timeout(8000).emit("reactMessage", { id, reactions }, (err) => {
      if (err) return toast(s.reactFail, true);
      // NO manual DOM write: the app's own socket receives the reactedMessage
      // broadcast and renders the chip itself — writing here doubled it
    });
  }

  function closeReactionPickers() {
    root().querySelectorAll(".bca-react-pop").forEach((p) => p.remove());
    if (reactionOutside) {
      document.removeEventListener("mousedown", reactionOutside, true);
      reactionOutside = null;
    }
  }

  function openReactionPicker(msgRoot, anchor) {
    const existing = root().querySelector(".bca-react-pop");
    closeReactionPickers();
    if (existing) return; // "+" toggles the picker
    const s = S();
    const pop = document.createElement("div");
    pop.className = "bca-popup bca-react-pop";
    pop.innerHTML = `
      <div class="bca-picker-entry">
        <input type="text" class="bca-emoji-search" />
      </div>
      <div class="bca-emoji-cats"></div>
      <div class="bca-emoji-grid"></div>`;
    const search = pop.querySelector(".bca-emoji-search");
    search.placeholder = s.symSearch;
    const cats = pop.querySelector(".bca-emoji-cats");
    const grid = pop.querySelector(".bca-emoji-grid");
    let activeCat = EMOJI_CATEGORIES[0].key;

    for (const cat of EMOJI_CATEGORIES) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "bca-emoji-cat" + (cat.key === activeCat ? " on" : "");
      tab.textContent = cat.icon;
      tab.title = cat.label[curLang()];
      tab.addEventListener("click", () => {
        activeCat = cat.key;
        cats.querySelectorAll(".bca-emoji-cat").forEach((x) => x.classList.toggle("on", x === tab));
        render();
      });
      cats.appendChild(tab);
    }

    function render() {
      grid.innerHTML = "";
      const q = search.value.trim().toLowerCase();
      const scan = q ? EMOJI_CATEGORIES : EMOJI_CATEGORIES.filter((c) => c.key === activeCat);
      let shown = 0;
      for (const cat of scan) {
        for (const [name, emoji] of cat.items) {
          if (q && !(name.toLowerCase().includes(q) || emoji.includes(q))) continue;
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bca-emoji";
          b.textContent = emoji;
          b.title = name;
          b.addEventListener("click", () => {
            reactOnMessage(msgRoot, emoji);
            closeReactionPickers();
          });
          grid.appendChild(b);
          shown++;
        }
      }
      if (!shown) {
        const none = document.createElement("div");
        none.className = "bca-chips-empty";
        none.textContent = s.symNoResults;
        grid.appendChild(none);
      }
    }
    search.addEventListener("input", render);
    render();

    // park it near the "+", clamped to the viewport
    const rect = anchor.getBoundingClientRect();
    const width = 320;
    pop.style.top = Math.max(rect.top - 330, 8) + "px";
    const right = Math.max(8, window.innerWidth - rect.right);
    pop.style.right = right + "px";
    if (rect.right < width + 8) pop.style.left = "8px";
    root().appendChild(pop);

    // outside click (anywhere that is not the popup or the "+") closes it —
    // a persistent listener, removed together with the popup
    reactionOutside = (e) => {
      if (!pop.contains(e.target) && !anchor.contains(e.target)) closeReactionPickers();
    };
    document.addEventListener("mousedown", reactionOutside, true);
  }

  /** the "+" sits at the far right of the 8-emoji quick-reaction row */
  function ensureReactionPlus() {
    if (!loggedIn) return;
    document.querySelectorAll(".dropdown-menu.context-menu.show").forEach((menu) => {
      if (menu.querySelector(".bca-react-plus")) return;
      const msgRoot = menu.closest('[id^="message-"]');
      if (!msgRoot) return;
      for (const row of menu.querySelectorAll(".dropdown-item, .menu-button")) {
        const emojiBtns = [...row.querySelectorAll(".btn")].filter(
          (b) => (b.textContent || "").trim().length <= 4
        );
        if (emojiBtns.length < 6) continue; // that's the reactions row, not others
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "btn btn-outline-secondary btn-sm icon-button bca-react-plus";
        plus.textContent = "＋";
        plus.title = S().reactMore;
        plus.setAttribute("aria-label", S().reactMore);
        plus.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openReactionPicker(msgRoot, plus);
        });
        row.appendChild(plus); // far right of the emoji row
        break;
      }
    });
  }

  // ---------- navbar icons (bootstrap-icons, matching the app's own) ----------
  const CLIPBOARD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM9.5 0h-3a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/></svg>';
  const SHIELD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-shield-lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/><path d="M9.5 6.5a1.5 1.5 0 0 1-1 1.415l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99a1.5 1.5 0 1 1 2-1.415z"/></svg>';

  let navBtn = null;
  let adminBtn = null;

  function refreshCopyUi() {
    const s = S();
    for (const [btn, label] of [[navBtn, s.menuCopy], [adminBtn, s.adminMenu]]) {
      if (btn && document.contains(btn)) {
        btn.title = label;
        btn.setAttribute("aria-label", label);
      }
    }
    const fab = root().querySelector(".bca-fab span");
    if (fab) {
      const wrapper = fab.closest(".bca-fab");
      wrapper.title = s.menuCopy;
      wrapper.setAttribute("aria-label", s.menuCopy);
      fab.textContent = s.fabLabel;
    }
  }

  function toggleCopyPopup() {
    if (root().querySelector(".bca-popup")) closePopup();
    else showExportPopup();
  }

  function toggleAdminPanel() {
    if (root().querySelector(".bca-popup")) closePopup();
    else showAdminPanel();
  }

  function navGroup() {
    const nav = document.querySelector(".navbar.fixed-top");
    return nav
      ? nav.querySelector(":scope > .me-2") || nav.querySelector(".icon-button")?.parentElement
      : null;
  }

  /** keep the copy + admin icons in the navbar icon group; remove whichever
      the current settings say should not be visible; re-attach whenever
      React re-renders them away */
  function ensureNavButtons() {
    const group = navGroup();
    if (!group) {
      addFab(); // fallback while the chat navbar isn't mounted yet
      return;
    }
    // navbar is available — the floating fallback is no longer needed
    root().querySelectorAll(".bca-fab").forEach((x) => x.remove());

    const wantCopy = loggedIn && copyAllowed();
    const wantAdmin = loggedIn && !!meUser?.isAdmin && features.supported;

    if (wantCopy && !navBtn) {
      navBtn = document.createElement("button");
      navBtn.type = "button";
      navBtn.className = "btn btn-outline-secondary btn-sm icon-button bca-navcopy";
      navBtn.innerHTML = CLIPBOARD_SVG;
      navBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCopyPopup();
      });
    }
    if (!wantCopy && navBtn) { navBtn.remove(); navBtn = null; }
    if (wantCopy && navBtn && navBtn.parentElement !== group) group.appendChild(navBtn);

    if (wantAdmin && !adminBtn) {
      adminBtn = document.createElement("button");
      adminBtn.type = "button";
      adminBtn.className = "btn btn-outline-secondary btn-sm icon-button bca-navadmin";
      adminBtn.innerHTML = SHIELD_SVG;
      adminBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleAdminPanel();
      });
    }
    if (!wantAdmin && adminBtn) { adminBtn.remove(); adminBtn = null; }
    if (wantAdmin && adminBtn && adminBtn.parentElement !== group) group.appendChild(adminBtn);

    refreshCopyUi();
  }

  /** when the admin hides the online-users list, regular users shouldn't even
      see the users tab / side panel — hide the React-rendered surfaces
      (mobile nav link, desktop column, reopen button); admins keep everything */
  function applyUsersPanelVisibility() {
    const hide =
      loggedIn && features.supported && !meUser?.isAdmin && features.canSeeOnlineUsers === false;
    document.querySelectorAll(".mobile-nav").forEach((nav) => {
      const usersLink = nav.children[1]; // nav is exactly [Chat, Users]
      if (usersLink) usersLink.style.display = hide ? "none" : "";
    });
    document.querySelectorAll(".special-column").forEach((col) => {
      if (!col.querySelector(".peoples-head, .search-box")) return;
      col.style.display = hide ? "none" : "";
    });
    document.querySelectorAll(".people-max").forEach((b) => {
      b.style.display = hide ? "none" : "";
    });
  }

  /** fallback when the navbar isn't available: floating button */
  function addFab() {
    if (root().querySelector(".bca-fab")) return;
    const s = S();
    const fab = document.createElement("button");
    fab.className = "bca-fab";
    fab.type = "button";
    fab.title = s.menuCopy;
    fab.setAttribute("aria-label", s.menuCopy);
    fab.innerHTML = `📋 <span>${s.fabLabel}</span>`;
    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCopyPopup();
    });
    root().appendChild(fab);
  }

  // ==================================================================
  // 3) notice marquee fix — duration from the real text width
  //    (the app hard-codes `40s` with %-based offsets, so long notices
  //     restart before their tail has ever been visible)
  // ==================================================================
  const MARQUEE_SPEED = 50; // px per second
  function fixMarquee(el) {
    const container = el.parentElement;
    if (!container) return;
    const cw = container.clientWidth;
    const tw = el.scrollWidth;
    if (!cw || !tw) return;
    if (el.__bcaW === tw && el.__bcaC === cw && el.__bcaDone) return;
    el.__bcaDone = true;
    el.__bcaW = tw;
    el.__bcaC = cw;
    el.style.animation = "none";
    el.style.setProperty("--bca-from", cw + "px");
    el.style.setProperty("--bca-to", -tw + "px");
    void el.offsetWidth; // reflow so the animation restarts cleanly
    const duration = Math.max((cw + tw) / MARQUEE_SPEED, 8);
    el.style.animation = `bca-marquee ${duration}s linear infinite`;
  }

  let scanPending = false;
  function scanUi() {
    if (scanPending) return;
    scanPending = true;
    t(120, () => {
      scanPending = false;
      document.querySelectorAll(".marquee-content").forEach(fixMarquee);
      if (loggedIn) ensureNavButtons();
      applyUsersPanelVisibility();
      if (loggedIn) ensureReactionPlus();
    });
  }

  // ---------- boot ----------
  // marquee fix + button re-attachment run on every page, immediately
  const uiObserver = new MutationObserver(scanUi);
  uiObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", scanUi);
  scanUi();

  let loggedIn = false;
  function teardown() {
    loggedIn = false;
    meUser = null;
    if (navBtn) { navBtn.remove(); navBtn = null; }
    if (adminBtn) { adminBtn.remove(); adminBtn = null; }
    root().querySelectorAll(".bca-fab").forEach((x) => x.remove());
    closePopup();
  }

  async function evaluateSession() {
    const me = await fetchMe();
    if (!me) {
      if (loggedIn) teardown();
      return; // logged out — nothing to do
    }
    loggedIn = true;
    meUser = me;
    await refreshFeatures();
    if (me.mustChangePassword) showForceChangeModal();
    else ensureNavButtons();
    applyUsersPanelVisibility();
  }
  // the React app navigates without reloading, so re-check on every route
  // change, re-attach the buttons if React wiped them, follow language flips,
  // and pick up admin setting changes within ~15 seconds
  let lastUrl = location.href;
  let lastLang = curLang();
  let visibilityTick = 0;
  setInterval(async () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      evaluateSession();
    }
    if (curLang() !== lastLang) {
      lastLang = curLang();
      refreshCopyUi();
    }
    if (loggedIn) {
      ensureNavButtons();
      ensureReactionPlus();
      if (++visibilityTick % 12 === 0) {
        await refreshFeatures();
        ensureNavButtons();
        applyUsersPanelVisibility();
      }
    }
  }, 1200);
  evaluateSession();
})();

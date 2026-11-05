"use strict";
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.validateNotePut = exports.notepadPage = exports.linksPage = exports.SETTINGS_HEADERS = void 0;
/**
 * Notepad + links pages — 1:1 companion to attendanceService.js.
 *
 * The attendance icon opens /links (owner design):
 *   1. হাজিরা কাউন্টার → /attendance
 *   2. নোটপ্যাড        → /notepad
 * /notepad is a plain big textarea: open → read → edit → save. Same access
 * as the attendance page (admins + the "selected" list — canViewAttendance);
 * the note is stored in the Setting document (settings gist), so it survives
 * redeploys and free-tier sleep. Nothing else renders — no SPA shell.
 */
const SETTING_LIMITS_REF = require("../models/Setting.js");
const SETTINGS_HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store, max-age=0",
    "X-Frame-Options": "SAMEORIGIN",
};
exports.SETTINGS_HEADERS = SETTINGS_HEADERS;
/** PUT /api/chat/attendance-note body guard — null when the note is too large */
const validateNotePut = (value) => {
    if (typeof value !== "string") return "";
    if (value.length > SETTING_LIMITS_REF.SETTING_LIMITS.attendanceNote) return null;
    return value;
};
exports.validateNotePut = validateNotePut;
/** 403 body for the notepad/links pages (logged-in but not permitted) */
const deniedBody = () => `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>প্রবেশাধিকার নেই</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:"Noto Sans Bengali",system-ui,sans-serif;background:#f6f7f9;color:#1b1f24;padding:24px;text-align:center}h1{font-size:18px;margin:0 0 6px}p{margin:0;color:#5b6572;font-size:14px}@media (prefers-color-scheme: dark){body{background:#12161b;color:#e8edf3}p{color:#9aa5b1}}</style>
</head><body><div><h1>প্রবেশাধিকার নেই</h1><p>এই পেজটা শুধু অনুমতি-প্রাপ্ত ইউজারের জন্য।</p></div></body></html>`;
/** /links — the list the attendance icon opens (owner design) */
const linksPage = () => ({
    status: 200,
    headers: SETTINGS_HEADERS,
    body: `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>পেজ-তালিকা</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 32px 16px; font-family: "Noto Sans Bengali", "Hind Siliguri", system-ui, sans-serif;
         background: #f6f7f9; color: #1b1f24; }
  h1 { font-size: 20px; margin: 0 0 18px; }
  a.item { display: flex; align-items: center; gap: 10px; padding: 16px 18px; margin-bottom: 12px;
           background: #fff; border: 1px solid #e3e8ee; border-radius: 12px; text-decoration: none;
           color: inherit; font-size: 16px; font-weight: 600; }
  a.item:hover { border-color: #2563eb; }
  a.item .ic { font-size: 20px; }
  a.item .sub { display: block; font-size: 12.5px; font-weight: 400; color: #5b6572; margin-top: 2px; }
  @media (prefers-color-scheme: dark) {
    body { background: #12161b; color: #e8edf3; }
    a.item { background: #1b2128; border-color: #2b333d; }
  }
</style>
</head>
<body>
  <h1>হাজিরা ও নোট</h1>
  <a class="item" href="/attendance" target="_blank" rel="noopener"><span class="ic">📋</span><span>হাজিরা কাউন্টার<span class="sub">হাজিরা দেওয়ার পেজ</span></span></a>
  <a class="item" href="/notepad" target="_blank" rel="noopener"><span class="ic">📝</span><span>নোটপ্যাড<span class="sub">শেয়ার্ড নোট — লিখুন ও সেভ করুন</span></span></a>
</body>
</html>`,
});
exports.linksPage = linksPage;
/** /notepad — a plain big textarea: open → read → edit → save (server-stored) */
const notepadPage = (initialNote) => ({
    status: 200,
    headers: SETTINGS_HEADERS,
    body: `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>নোটপ্যাড</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 24px 16px; font-family: "Noto Sans Bengali", "Hind Siliguri", system-ui, sans-serif;
         background: #f6f7f9; color: #1b1f24; }
  h1 { font-size: 20px; margin: 0 0 14px; }
  textarea { width: 100%; min-height: 55vh; font: 15px/1.6 inherit; padding: 14px;
             border-radius: 10px; border: 1px solid #c9d1da; background: #fff; color: inherit;
             box-sizing: border-box; resize: vertical; }
  .bar { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
  button { font: inherit; padding: 10px 18px; border-radius: 8px; border: 1px solid #2563eb;
           background: #2563eb; color: #fff; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  #msg { font-size: 13px; color: #5b6572; }
  a.back { color: #2563eb; text-decoration: none; font-size: 14px; }
  @media (prefers-color-scheme: dark) {
    body { background: #12161b; color: #e8edf3; }
    textarea { background: #1b2128; border-color: #2b333d; }
  }
</style>
</head>
<body>
  <h1>নোটপ্যাড</h1>
  <textarea id="note" spellcheck="false"></textarea>
  <div class="bar">
    <button id="save">সেভ করুন</button>
    <span id="msg"></span>
    <span style="flex:1"></span>
    <a class="back" href="/links">← তালিকায় ফিরুন</a>
  </div>
<script>
    (function () {
      var box = document.getElementById("note");
      var msg = document.getElementById("msg");
      var save = document.getElementById("save");
      box.value = ${JSON.stringify(typeof initialNote === "string" ? initialNote.slice(0, SETTING_LIMITS_REF.SETTING_LIMITS.attendanceNote) : "")};
      save.onclick = function () {
        save.disabled = true;
        msg.textContent = "সেভ হচ্ছে…";
        fetch("/api/chat/attendance-note", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: box.value })
        }).then(function (r) {
          if (r.ok) { msg.textContent = "সেভ হয়েছে"; setTimeout(function () { msg.textContent = ""; }, 2000); }
          else { msg.textContent = "সেভ হয়নি — আবার চেষ্টা করুন"; }
        }).catch(function () { msg.textContent = "সার্ভারে পৌঁছানো যাচ্ছে না"; })
        .finally ? null : null;
        save.disabled = false;
      };
    })();
  </script>
</body>
</html>`,
});
exports.notepadPage = notepadPage;

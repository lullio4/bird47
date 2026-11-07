"use strict";
/**
 * Notepad + links pages — 1:1 companion to attendanceService.js.
 *
 * The attendance icon opens /links (owner design):
 *   1. হাজিরা কাউন্টার → /attendance
 *   2. নোটপ্যাড        → /notepad
 * /notepad is a protectedtext-style multi-tab notepad: click-to-switch tabs,
 * "+" adds a tab, tab title = first line of its content, Tab key inserts 4
 * spaces, Ctrl+S saves, unsaved-change warning on close/reload. Tabs are
 * joined/split with the invisible separator (SHA512("-- tab separator --"), the
 * same MIT-licensed pattern as protectedtext.com); the note text itself is
 * unlimited (chunked server storage via noteStore.js). Same access as the
 * attendance page (canViewAttendance); nothing else renders — no SPA shell.
 */
const SETTING_LIMITS_REF = require("../models/Setting.js");
const NoteService_1 = require("./noteService.js");
const { SEPARATOR } = NoteService_1;
// harmless placeholder for a legacy caller signature — the page fetches its note
const SETTINGS_HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store, max-age=0",
    "X-Frame-Options": "SAMEORIGIN",
};
exports.SETTINGS_HEADERS = SETTINGS_HEADERS;
/** 403 body for the notepad/links pages (logged-in but not permitted) */
const deniedBody = () => `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>প্রবেশাধিকার নেই</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:"Noto Sans Bengali",system-ui,sans-serif;background:#f6f7f9;color:#1b1f24;padding:24px;text-align:center}h1{font-size:18px;margin:0 0 6px}p{margin:0;color:#5b6572;font-size:14px}@media (prefers-color-scheme: dark){body{background:#12161b;color:#e8edf3}p{color:#9aa5b1}}</style>
</head><body><div><h1>প্রবেশাধিকার নেই</h1><p>এই পেজটা শুধু অনুমতি-প্রাপ্ত ইউজারের জন্য।</p></div></body></html>`;
exports.deniedBody = deniedBody;
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
           color: inherit; font-size: 16px; weight: 600; }
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
  <a class="item" href="/notepad" target="_blank" rel="noopener"><span class="ic">📝</span><span>নোটপ্যাড<span class="sub">শেয়ার্ড নোট — ট্যাবসহ, আনলিমিটেড</span></span></a>
</body>
</html>`,
});
exports.linksPage = linksPage;
/** /notepad — protectedtext-style multi-tab notepad (client fetches the note; unlimited) */
const notepadPage = function (initialNote, tabCount) {
    const _legacy = typeof initialNote === "string" ? initialNote : "";
    const _tabs = Math.max(typeof tabCount === "number" ? tabCount : 1, 1);
    const SEPARATOR_JSON = JSON.stringify(NoteService_1.SEPARATOR);
    return ({
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
  body { margin: 0; padding: 20px 16px 28px; font-family: "Noto Sans Bengali", "Hind Siliguri", system-ui, sans-serif;
         background: #f6f7f9; color: #1b1f24; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .tab { display: inline-flex; align-items: center; gap: 8px; max-width: 240px; padding: 7px 12px;
         font: inherit; font-size: 13.5px; border: 1px solid #c9d1da; border-radius: 8px 8px 0 0;
         background: #eceff3; color: inherit; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
  .tab.dragging { opacity: .55; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
  .tab.drop-before { box-shadow: -3px 0 0 0 #2563eb; }
  .tab.drop-after { box-shadow: 3px 0 0 0 #2563eb; }
  .tab.active { background: #fff; border-color: #2563eb; border-bottom-color: #fff; font-weight: 600; }
  .tab .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tab .x { border: 0; background: none; color: #5b6572; cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1; }
  .tab .x:hover { color: #c62828; }
  #addtab { padding: 7px 14px; font: inherit; font-size: 14px; border: 1px dashed #9aa5b1; border-radius: 8px;
            background: none; color: inherit; cursor: pointer; }
  #addtab:hover { border-color: #2563eb; color: #2563eb; }
  textarea { width: 100%; min-height: 55vh; font: 15px/1.6 inherit; padding: 14px;
             border-radius: 10px; border: 1px solid #c9d1da; background: #fff; color: inherit;
             box-sizing: border-box; resize: vertical; white-space: pre; }
  .bar { display: flex; gap: 12px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
  button.save { font: inherit; padding: 10px 18px; border-radius: 8px; border: 1px solid #2563eb;
           background: #2563eb; color: #fff; cursor: pointer; }
  button.save:disabled { opacity: .6; cursor: default; }
  #msg { font-size: 13px; color: #5b6572; }
  #chars { font-size: 12.5px; color: #5b6572; }
  a.back { color: #2563eb; text-decoration: none; font-size: 14px; }
  @media (prefers-color-scheme: dark) {
    body { background: #12161b; color: #e8edf3; }
    textarea { background: #1b2128; border-color: #2b333d; }
    .tab { background: #1b2128; border-color: #2b333d; }
    .tab.active { background: #232b34; border-color: #2563eb; }
  }
</style>
</head>
<body>
  <h1>নোটপ্যাড</h1>
  <div class="tabs" id="tabsbar"></div>
  <textarea id="note" spellcheck="false"></textarea>
  <div class="bar">
    <button class="save" id="save">সেভ করুন</button>
    <span id="msg"></span>
    <span id="chars"></span>
    <span style="flex:1"></span>
    <a class="back" href="/links">← তালিকায় ফিরুন</a>
  </div>
<script>
    (function () {
      var SEP = ${SEPARATOR_JSON};
      var box = document.getElementById("note");
      var bar = document.getElementById("tabsbar");
      var msg = document.getElementById("msg");
      var chars = document.getElementById("chars");
      var save = document.getElementById("save");
      var tabs = [];                      // [{content}] — protectedtext মডেল; সার্ভ করার সময় ভরা হয়
      var active = 0;
      var savedText = "";                 // সার্ভারে থাকা জোড়া-টেক্সট; লোড-ফেচ সফল হলে সেট হয়
      function titleFrom(c) {
        var t = (c || "").replace(/\\r/g, "");
        var nl = t.indexOf("\\n");
        var line = (nl === -1 ? t : t.slice(0, nl)).trim();
        return line ? line.slice(0, 40) : "ফাঁকা ট্যাব";
      }
      function render() {
        bar.innerHTML = "";
        tabs.forEach(function (tb, i) {
          var el = document.createElement("div");
          el.className = "tab" + (i === active ? " active" : "");
          var t = document.createElement("span"); t.className = "t"; t.textContent = titleFrom(tb.content);
          var x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕"; x.title = "ট্যাব বন্ধ করুন"; x.style.touchAction = "none";
          x.onclick = function (e) { e.stopPropagation(); closeTab(i); };
          el.appendChild(t); el.appendChild(x);
          el.onclick = function () { if (Date.now() - lastDragEnd < 400) return; if (i !== active) { commitActive(); active = i; render(); focusBox(); } };
          bar.appendChild(el);
        });
        var add = document.createElement("button");
        add.id = "addtab"; add.type = "button"; add.textContent = "+ নতুন ট্যাব";
        add.onclick = addTab;
        bar.appendChild(add);
        box.value = tabs[active] ? tabs[active].content : "";
        updateChars();
      }
      function commitActive() {
        if (tabs[active]) tabs[active].content = box.value;
        if (tabs[active]) tabs[active].title = titleFrom(tabs[active].content);
      }
      function addTab() { commitActive(); tabs.push({ title: "ফাঁকা ট্যাব", content: "" }); active = tabs.length - 1; render(); focusBox(); }
      // ---- tab re-ordering (swap by drag) — protectedtext.com-style (MIT):
      // their jQuery-UI sortable uses {distance:5, tolerance:"pointer"}; this is
      // the pointer-events twin: press → move ≥5px = drag (else click), drop
      // inserts the dragged tab at the hovered tab's edge. Mobile touch works
      // via pointer events; reordering marks the note modified (unsaved warning).
      var drag = null; // {from, startX, started}
      var lastDragEnd = 0; // a real drag must not end as an accidental tab-switch click
      function clearDropMarks() {
        for (var i = 0; i < bar.children.length; i++) {
          var ch = bar.children[i];
          if (ch.classList) ch.classList.remove("drop-before", "drop-after");
        }
      }
      function dragTargetFromPoint(x, y) {
        var els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el && el.classList && el.classList.contains("tab") && bar.contains(el)) return el;
        }
        return null;
      }
      bar.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        // the ✕ close-button is NOT a drag handle — starting a drag here (and
        // capturing the pointer on the tab) would retarget the click to the
        // tab element, so closeTab() never fired (user report 2026-11-07)
        if (e.target.closest && e.target.closest(".x")) return;
        var el = e.target.closest ? e.target.closest(".tab") : null;
        if (!el || !bar.contains(el)) return;
        drag = { el: el, from: [].indexOf.call(bar.children, el), startX: e.clientX, started: false };
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* older engines */ }
      });
      bar.addEventListener("pointermove", function (e) {
        if (!drag) return;
        if (!drag.started) {
          if (Math.abs(e.clientX - drag.startX) < 5) return;
          drag.started = true;
          drag.el.classList.add("dragging");
        }
        e.preventDefault();
        clearDropMarks();
        var over = dragTargetFromPoint(e.clientX, e.clientY);
        if (over && over !== drag.el) {
          var r = over.getBoundingClientRect();
          over.classList.add(e.clientX < r.left + r.width / 2 ? "drop-before" : "drop-after");
        }
      }, { passive: false });
      bar.addEventListener("pointerup", function (e) {
        if (!drag) return;
        var d = drag; drag = null;
        try { d.el.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
        if (!d.started) return; // plain click — tab switch handler runs as usual
        d.el.classList.remove("dragging");
        clearDropMarks();
        var over = dragTargetFromPoint(e.clientX, e.clientY);
        if (!over || over === d.el) return;
        var to = [].indexOf.call(bar.children, over);
        var r = over.getBoundingClientRect();
        var after = e.clientX > r.left + r.width / 2;
        // sortable arithmetic: DOM index → post-removal insert index
        if (d.from < to) { if (!after) to -= 1; }
        else if (after) to += 1;
        if (d.from === to) return;
        commitActive();
        var moved = tabs.splice(d.from, 1)[0];
        tabs.splice(to, 0, moved);
        if (active === d.from) active = to; else if (d.from < active && active <= to) active -= 1; else if (to <= active && active < d.from) active += 1;
        lastDragEnd = Date.now();
        render(); focusBox();
      });
      bar.addEventListener("pointercancel", function () {
        if (!drag) return;
        drag.el.classList.remove("dragging");
        clearDropMarks();
        drag = null;
      });
      function closeTab(i) {
        if (tabs.length === 1) { tabs = [{ title: "ফাঁকা ট্যাব", content: "" }]; active = 0; render(); focusBox(); return; }
        tabs.splice(i, 1); if (active >= tabs.length) active = tabs.length - 1; render(); focusBox();
      }
      function focusBox() { try { box.focus(); } catch (e) {} }
      function updateChars() { chars.textContent = totalChars() + " অক্ষর"; }
      function joined() { commitActive(); return tabs.map(function (tb) { return tb.content; }).join(SEP); }
      function totalChars() { return tabs.reduce(function (n, tb) { return n + (tb.content ? tb.content.length : 0); }, 0); }
      box.addEventListener("input", function () {
        if (tabs[active]) { tabs[active].content = box.value; tabs[active].title = titleFrom(box.value); }
        updateChars();
        var t = titleFrom(box.value);
        var el = bar.children[active];
        if (el && el.firstElementChild) el.firstElementChild.textContent = t;
      });
      // Tab key → 4 spaces (protectedtext pattern)
      box.addEventListener("keydown", function (e) {
        if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
          e.preventDefault();
          var s = box.selectionStart, en = box.selectionEnd;
          box.value = box.value.substring(0, s) + "    " + box.value.substring(en);
          box.selectionStart = box.selectionEnd = s + 4;
          box.dispatchEvent(new Event("input"));
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); doSave(); }
      });
      function doSave() {
        commitActive();
        save.disabled = true;
        msg.textContent = "সেভ হচ্ছে…";
        fetch("/api/chat/attendance-note", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: joined() })
        }).then(function (r) {
          if (r.ok) { savedText = joined(); msg.textContent = "সেভ হয়েছে"; setTimeout(function () { msg.textContent = ""; }, 2000); }
          else if (r.status === 413) { msg.textContent = "খুব বড় — একবারে এত বড় নোট সেভ করা যায় না"; }
          else { msg.textContent = "সেভ হয়নি — আবার চেষ্টা করুন"; }
        }).catch(function () { msg.textContent = "সার্ভারে পৌঁছানো যাচ্ছে না"; });
        save.disabled = false;
      }
      save.onclick = doSave;
      window.addEventListener("beforeunload", function (e) {
        if (joined() !== savedText) { e.preventDefault(); e.returnValue = ""; }
      });
      render(); focusBox();
      // লোড: সার্ভার-স্টোর থেকে নোট আনুন (আনলিমিটেড — তাই পেজে ইনজেক্ট নয়)
      fetch("/api/chat/attendance-note", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) { msg.textContent = "নোট লোড হয়নি — সেভ করার আগে রিফ্রেশ করুন"; return; }
          var parts = (typeof data.note === "string" && data.note) ? data.note.split(SEP) : [""];
          tabs = parts.map(function (p) { return { content: p }; });
          savedText = data.note || "";
          active = 0;
          render(); focusBox();
        })
        .catch(function () { msg.textContent = "নোট লোড হয়নি — সংযোগ দেখুন"; });
    })();
  </script>
</body>
</html>` });
};
exports.notepadPage = notepadPage;

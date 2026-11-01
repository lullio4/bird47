"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
// exports are assigned after each const declaration (a "use strict" CJS file
// cannot touch an uninitialized const binding before its declaration line)

const Setting_1 = require("../models/Setting.js");
const SETTING_LIMITS = Setting_1.SETTING_LIMITS;
exports.SETTING_LIMITS = SETTING_LIMITS;

/**
 * The attendance counter is a *raw html document* owned by the admin.
 * It is stored verbatim (no sanitizing: it is admin-authored, and the admin
 * may legitimately use inline <script>/<style>) and served as the whole
 * response body of GET /attendance — nothing else is rendered on that URL.
 */

/** payload of the admin editor (GET/PUT /api/chat/attendance) */
const attendanceSettingsPayload = (setting) => ({
    attendanceViewMode: setting?.attendanceViewMode === "selected" ? "selected" : "admin",
    attendanceSelected: Array.isArray(setting?.attendanceSelected) ? setting.attendanceSelected : [],
    attendanceHtml: typeof setting?.attendanceHtml === "string" ? setting.attendanceHtml : "",
    // always sent: the editor's "restore starter page" button must work even
    // after the admin saved a custom document
    defaultHtml: Setting_1.ATTENDANCE_DEFAULT_HTML,
    limit: SETTING_LIMITS.attendanceHtml,
});

/**
 * @returns {string|null} the html to store, or null when the input is invalid
 */
const validateAttendanceHtml = (value) => {
    if (typeof value !== "string") return "";
    if (value.length > SETTING_LIMITS.attendanceHtml) return null;
    return value;
};

const HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    // the page is admin-authored and may embed its own scripts — keep the
    // browser from sniffing a different type, but allow inline code
    "X-Content-Type-Options": "nosniff",
    // never let a proxy/CDN hand a stale editor state back to the admin
    "Cache-Control": "no-store, max-age=0",
    // the document is self-contained; no external framing
    "X-Frame-Options": "SAMEORIGIN",
};

/** the rendered counter page: the stored document, byte for byte */
const renderAttendancePage = (html) => ({
    status: 200,
    headers: HEADERS,
    body: typeof html === "string" && html.trim().length > 0 ? html : Setting_1.ATTENDANCE_DEFAULT_HTML,
});

/** shown to a logged-in user who is not allowed to open the page */
const attendanceDeniedPage = () => ({
    status: 403,
    headers: HEADERS,
    body: `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>প্রবেশাধিকার নেই</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:"Noto Sans Bengali",system-ui,sans-serif;background:#f6f7f9;color:#1b1f24;padding:24px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#5b6572;font-size:14px}</style>
</head><body><div><h1>এই পেজ দেখার অনুমতি নেই</h1><p>অ্যাডমিনের সাথে যোগাযোগ করুন।</p></div></body></html>`,
});

/** shown when the visitor has no session at all */
const attendanceEmptyPage = (loginPath) => ({
    status: 401,
    headers: HEADERS,
    body: `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>লগইন প্রয়োজন</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:"Noto Sans Bengali",system-ui,sans-serif;background:#f6f7f9;color:#1b1f24;padding:24px;text-align:center}a{display:inline-block;margin-top:14px;padding:9px 16px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-size:14px}</style>
</head><body><div><h1>লগইন করুন</h1><p>হাজিরা কাউন্টার দেখতে প্রথমে অ্যাপে লগইন করতে হবে।</p><a href="${loginPath || "/login"}">লগইন পেজে যান</a></div></body></html>`,
});

exports.attendanceSettingsPayload = attendanceSettingsPayload;
exports.validateAttendanceHtml = validateAttendanceHtml;
exports.renderAttendancePage = renderAttendancePage;
exports.attendanceDeniedPage = attendanceDeniedPage;
exports.attendanceEmptyPage = attendanceEmptyPage;

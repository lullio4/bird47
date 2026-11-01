"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deleteAllChat = exports.buildExportTxt = exports.buildExportHtml = exports.buildExportJson = exports.downloadAll = exports.downloadJson = void 0;
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const config_1 = require("../config/repositoryFactory.js");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const htmlSanitizer_1 = require("./htmlSanitizer.js");
const log = (0, logger_1.default)(__filename);
async function getAllMessages() {
    const repository = (0, config_1.getMessageRepository)();
    return repository.get();
}
function plainText(html) {
    // strip markup and collapse whitespace — safe for plain notes
    return (0, sanitize_html_1.default)(String(html ?? ""), { allowedTags: [], allowedAttributes: {} })
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function formatTimestamp(iso) {
    // stable universal "YYYY-MM-DD HH:mm" in the room's timezone
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return String(iso || "");
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: process.env.HIJRI_TIMEZONE || "Asia/Dhaka",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
// Download JSON file with filtered messages (admin endpoint)
const downloadJson = async (res) => {
    log.debug("download all called");
    const messages = await getAllMessages();
    const filteredMessages = messages.map(({ username, text, time, replyTo }) => ({
        username,
        text,
        time,
        replyTo,
    }));
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=Message.json");
    res.status(200).send(JSON.stringify(filteredMessages, null, 2));
};
exports.downloadJson = downloadJson;
// Download JSON file with filtered messages (admin endpoint)
const downloadAll = async () => {
    log.debug("download all called");
    const messages = await getAllMessages();
    return messages.map(({ username, text, time, replyTo }) => ({
        username,
        text,
        time,
        replyTo,
    }));
};
exports.downloadAll = downloadAll;
/** raw full history for the json export option */
const buildExportJson = async () => {
    const messages = await getAllMessages();
    return messages.map((m) => ({
        id: m.id,
        username: m.username,
        time: m.time,
        text: m.text,
        replyTo: m.replyTo || null,
        edited_at: m.edited_at || null,
        reactions: m.reactions && Object.keys(m.reactions).length ? m.reactions : undefined,
    }));
};
exports.buildExportJson = buildExportJson;
/** localized labels for the plain-text export (the room is bn/en bilingual) */
const TXT_I18N = {
    bn: {
        title: "Our Discussion Room — পূর্ণ কথোপকথন",
        exported: "এক্সপোর্ট",
        total: "মোট মেসেজ",
        edited: "(সম্পাদিত)",
        media: "(মিডিয়া/HTML মেসেজ)",
        replyTo: "উত্তর →",
    },
    en: {
        title: "Our Discussion Room — full conversation",
        exported: "Exported",
        total: "Total messages",
        edited: "(edited)",
        media: "(media/HTML message)",
        replyTo: "reply to",
    },
};
/** clean plain-text rendering of the whole conversation — paste-ready for notes */
const buildExportTxt = async (lang = "bn") => {
    const i18n = TXT_I18N[lang] || TXT_I18N.bn;
    const messages = await getAllMessages();
    const line = "--------------------------------------";
    const header = [
        "======================================",
        i18n.title,
        `${i18n.exported}: ${formatTimestamp(new Date().toISOString())}`,
        `${i18n.total}: ${messages.length}`,
        "======================================",
        "",
    ].join("\n");
    const body = messages.map((m) => {
        const stamp = formatTimestamp(m.time);
        const edited = m.edited_at ? `  ${i18n.edited}` : "";
        const text = plainText(m.text) || i18n.media;
        const lines = [`[${stamp}] ${m.username || "?"}:`, text + edited];
        if (m.replyTo) {
            const quoted = plainText(m.replyTo.text).slice(0, 80);
            lines.splice(1, 0, `    ↳ ${i18n.replyTo} ${m.replyTo.username || "?"}${m.replyTo.id ? ` (#${m.replyTo.id})` : ""}: "${quoted}"`);
        }
        return lines.join("\n");
    }).join(`\n\n${line}\n\n`);
    return header + body + "\n";
};
exports.buildExportTxt = buildExportTxt;
const HTML_I18N = {
    bn: {
        title: "Our Discussion Room — পূর্ণ কথোপকথন",
        exported: "এক্সপোর্ট",
        total: "মোট মেসেজ",
        edited: "সম্পাদিত",
        replyTo: "উত্তর →",
        reactions: "রিঅ্যাকশন",
        empty: "কোনো মেসেজ নেই।",
    },
    en: {
        title: "Our Discussion Room — full conversation",
        exported: "Exported",
        total: "Total messages",
        edited: "edited",
        replyTo: "reply to",
        reactions: "reactions",
        empty: "No messages.",
    },
};
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
/** rich rendering of the whole conversation — messages keep their HTML
    (bold, images, audio, styles) exactly as they appear in the chat */
const buildExportHtml = async (lang = "bn") => {
    const i18n = HTML_I18N[lang] || HTML_I18N.bn;
    const messages = await getAllMessages();
    const cards = messages.map((m) => {
        const edited = m.edited_at
            ? `<span class="edited">✎ ${escapeHtml(i18n.edited)}</span>`
            : "";
        const reply = m.replyTo
            ? `<div class="reply">↳ ${escapeHtml(i18n.replyTo)} <b>${escapeHtml(m.replyTo.username || "?")}</b>${m.replyTo.id ? ` <span class="rid">#${escapeHtml(m.replyTo.id)}</span>` : ""}: <span class="rtext">${escapeHtml(plainText(m.replyTo.text).slice(0, 120))}</span></div>`
            : "";
        const reactions = m.reactions && Object.keys(m.reactions).length
            ? `<div class="reacts">${Object.entries(m.reactions)
                .filter(([, r]) => r && Array.isArray(r.usernames))
                .map(([emoji, r]) => `<span class="react">${escapeHtml(emoji)}${r.usernames.length ? ` ×${r.usernames.length}` : ""}</span>`)
                .join(" ")}</div>`
            : "";
        // stored text is already sanitized on input; sanitize again (same
        // allowlist) so the exported file can never carry active content
        const body = (0, htmlSanitizer_1.sanitizeMessageHtml)(String(m.text ?? "")) || `<span class="empty-body">…</span>`;
        return [
            `<div class="msg">`,
            `  <div class="head"><span class="user">${escapeHtml(m.username || "?")}</span><span class="time">${escapeHtml(formatTimestamp(m.time))}</span>${edited}</div>`,
            reply,
            `  <div class="body" dir="auto">${body}</div>`,
            reactions,
            `</div>`,
        ]
            .filter(Boolean)
            .join("\n");
    });
    const style = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef1f5; color: #1d2129;
      font-family: "Noto Sans Bengali", "Hind Siliguri", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 15px; line-height: 1.55; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 24px 14px 48px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #65676b; font-size: 13px; margin: 0 0 20px; }
    .msg { background: #fff; border: 1px solid #e2e6ea; border-radius: 12px;
      padding: 10px 14px; margin: 0 0 10px; overflow-wrap: break-word; }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .user { font-weight: 600; color: #0b5cff; }
    .time { color: #8a8d91; font-size: 12px; }
    .edited { color: #f0a020; font-size: 12px; }
    .reply { background: #f0f2f5; border-inline-start: 3px solid #c3cbd6; border-radius: 6px;
      padding: 4px 10px; margin: 0 0 6px; font-size: 13px; color: #444950; }
    .reply .rtext { font-style: italic; }
    .reply .rid, .body img, .body audio, .body video { max-width: 100%; }
    .reply .rid { color: #8a8d91; font-size: 11px; }
    .body img { border-radius: 8px; }
    .reacts { margin-top: 6px; }
    .react { background: #e7f0ff; border: 1px solid #c3d7f7; border-radius: 999px;
      display: inline-block; padding: 0 8px; font-size: 13px; margin-inline-end: 4px; }
    .empty-body { color: #8a8d91; }`;
    return `<!DOCTYPE html>
<html lang="${lang === "en" ? "en" : "bn"}" dir="${lang === "en" ? "ltr" : "rtl"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(i18n.title)}</title>
<style>${style}</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(i18n.title)}</h1>
  <p class="meta">${escapeHtml(i18n.exported)}: ${escapeHtml(formatTimestamp(new Date().toISOString()))} · ${escapeHtml(i18n.total)}: ${messages.length}</p>
${messages.length ? cards.join("\n") : `  <div class="msg">${escapeHtml(i18n.empty)}</div>`}
</div>
</body>
</html>
`;
};
exports.buildExportHtml = buildExportHtml;
const deleteAllChat = async (res) => {
    // Get the repository
    const repository = (0, config_1.getMessageRepository)();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    await repository.removeAll();
};
exports.deleteAllChat = deleteAllChat;

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
/**
 * Server-side HTML sanitizer for chat messages and notices.
 *
 * HTML+CSS inside messages is a supported feature (the client renders it via
 * DOMPurify). This allowlist keeps that feature intact while stripping the
 * dangerous parts (script/iframe/event handlers/javascript: URLs) so stored
 * data is safe for any consumer, not just the bundled client.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.sanitizeMessageHtml = sanitizeMessageHtml;
exports.sanitizeNoticeHtml = sanitizeNoticeHtml;
exports.MAX_MESSAGE_CHARS = exports.MAX_NOTICE_CHARS = void 0;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const MAX_MESSAGE_CHARS = parseInt(process.env.MAX_MESSAGE_CHARS || "5000", 10);
exports.MAX_MESSAGE_CHARS = MAX_MESSAGE_CHARS;
const MAX_NOTICE_CHARS = parseInt(process.env.MAX_NOTICE_CHARS || "20000", 10);
exports.MAX_NOTICE_CHARS = MAX_NOTICE_CHARS;
const baseOptions = {
    allowedTags: [
        ...sanitize_html_1.default.defaults.allowedTags,
        "img", "audio", "video", "source", "figure", "figcaption",
        "style", "s", "u", "font", "mark", "details", "summary", "del", "ins",
    ],
    allowedAttributes: {
        "*": ["style", "class", "title", "dir", "lang", "align"],
        a: ["href", "name", "target", "rel"],
        img: ["src", "srcset", "alt", "width", "height", "loading"],
        audio: ["src", "controls", "loop", "preload"],
        video: ["src", "controls", "width", "height", "poster", "preload", "loop"],
        source: ["src", "type"],
        td: ["colspan", "rowspan"],
        th: ["colspan", "rowspan"],
        font: ["color", "face", "size"],
        details: ["open"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"], audio: ["http", "https"], video: ["http", "https"], source: ["http", "https"] },
    allowProtocolRelative: false,
};
function sanitizeMessageHtml(text) {
    if (typeof text !== "string")
        return "";
    return (0, sanitize_html_1.default)(text, baseOptions);
}
function sanitizeNoticeHtml(text) {
    if (typeof text !== "string")
        return "";
    return (0, sanitize_html_1.default)(text, baseOptions);
}

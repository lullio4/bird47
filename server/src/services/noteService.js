"use strict";
/**
 * Shared notepad service — one hub for the pages, the REST API and the tests.
 * The note is unlimited (chunked storage via noteStore.js) and organized in
 * tabs like protectedtext.com: tabs are separated by an invisible 128-char
 * separator string (the same SHA512("-- tab separator --") pattern as the
 * original, licensed MIT); the client splits/joins on it. Two server-side
 * helpers exist so every consumer uses the same separator:
 *   splitNoteTabs(text)  → string[]
 *   joinNoteTabs(parts)  → string
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEPARATOR = void 0;
exports.splitNoteTabs = splitNoteTabs;
exports.joinNoteTabs = joinNoteTabs;
exports.getNoteState = getNoteState;
exports.saveNoteText = saveNoteText;
const NoteService_1 = require("../services/noteService.js");
const noteStore_1 = require("./noteStore.js");
// protectedtext-compatible invisible tab separator (MIT, protectedtext.com/js/main.js)
const CryptoJS = require("crypto-js");
const SEPARATOR = CryptoJS.SHA512("-- tab separator --").toString();
exports.SEPARATOR = SEPARATOR;
// runaway-payload guard only — the note itself is unlimited (chunked storage);
// 10M chars ≈ 25 chunks ≈ a few MB of gist data, far beyond any real note
const MAX_NOTE_CHARS = Math.max(parseInt(process.env.MAX_NOTE_CHARS || "10000000", 10), 100000);
exports.MAX_NOTE_CHARS = MAX_NOTE_CHARS;
/** tab texts from the stored joined form */
function splitNoteTabs(text) {
    return (typeof text === "string" && text) ? text.split(SEPARATOR) : [""];
}
/** store-form text from tab texts (single empty tab ↔ "") */
function joinNoteTabs(parts) {
    const safe = Array.isArray(parts) ? parts.filter((p) => typeof p === "string") : [];
    const clean = safe.length ? safe : [""];
    return clean.some((p) => p !== "") ? clean.join(SEPARATOR) : "";
}
/** GET payload: full joined text + tab count */
async function getNoteState() {
    const text = await noteStore_1.readNote();
    return { text, tabs: splitNoteTabs(text).length };
}
/** PUT: replace the whole note; returns the state after save */
async function saveNoteText(text) {
    const joined = joinNoteTabs(splitNoteTabs(typeof text === "string" ? text : ""));
    const res = await noteStore_1.writeNote(joined);
    return { chars: res.chars, tabs: splitNoteTabs(joined).length };
}

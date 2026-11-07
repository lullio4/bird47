"use strict";
/**
 * Unlimited shared notepad storage ("unlimited" = bound only by the 512MB RAM
 * of the free tier — practically unbounded). The note is split into fixed-size
 * chunks stored as items of one synthetic model ("Note") on the SAME backend
 * family the app already uses:
 *   - disk backend (local dev): plain JSON file data/Note.json (no gist needed)
 *   - gist backend (Render):    sharded gists (one gist per chunk, ≤ ~500KB raw
 *     JSON each → ~670KB encrypted — safe against the ~1MB per-file gist limit)
 *
 * Chunk sizes are counted in JS string-index units — safe here: the chunk size
 * is ~4× below every hard limit, so even a split surrogate pair costs at most
 * one extra chunk and never corrupts content.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTE_CHUNK_CHARS = void 0;
exports.readNote = readNote;
exports.writeNote = writeNote;
const logger_1 = require("../logger.js");
const Storage_1 = require("../models/storageTypes.js");
const ShardedNoteRepository_1 = require("../repositories/ShardedNoteRepository.js");
const DiskStorageRepositoryImpl_1 = require("../repositories/DiskStorageRepositoryImpl.js");
const log = (0, logger_1.default)(__filename);
// ~400K chars per chunk → ~405KB raw JSON → ~540KB encrypted — a ~2× margin
// against the ~1MB gist file limit; also below MemoryGist's 900KB warn line
const NOTE_CHUNK_CHARS = Math.max(parseInt(process.env.NOTE_CHUNK_CHARS || "400000", 10), 10000);
exports.NOTE_CHUNK_CHARS = NOTE_CHUNK_CHARS;
let noteRepository = null;
/** Note storage follows the deployment's primary backend: gist on Render, disk otherwise */
function getNoteRepository() {
    if (!noteRepository) {
        const defaultStorage = process.env.REPOSITORY_NAME || Storage_1.StorageTypes.diskStorage;
        const storageType = defaultStorage === Storage_1.StorageTypes.githubGistStorage
            ? Storage_1.StorageTypes.githubGistStorage
            : Storage_1.StorageTypes.diskStorage;
        if (storageType === Storage_1.StorageTypes.githubGistStorage) {
            const token = process.env.githubGist_token ?? "";
            const username = process.env.githubGist_username ?? "";
            if (!token || !username) {
                log.error("githubGist env vars are required for githubGistStorage (Note)");
                throw new Error("gist credentials missing for Note storage");
            }
            noteRepository = new ShardedNoteRepository_1.ShardedNoteRepository(
                { token, username }, Storage_1.StorageModels.Note, process.env.encryption_password ?? "");
        }
        else {
            noteRepository = new DiskStorageRepositoryImpl_1.DiskStorageRepositoryImpl(Storage_1.StorageModels.Note);
        }
    }
    return noteRepository;
}
/** full note text, assembled from chunks in id order ("" when empty) */
async function readNote() {
    const repo = getNoteRepository();
    const items = await repo.get();
    return items
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((it) => (typeof it.chunk === "string" ? it.chunk : ""))
        .join("");
}
/** replace the whole note with `text` (any length) — diff-free chunk rewrite */
async function writeNote(text) {
    const safe = typeof text === "string" ? text : "";
    const chunks = [];
    for (let i = 0; i < safe.length; i += NOTE_CHUNK_CHARS) {
        chunks.push(safe.slice(i, i + NOTE_CHUNK_CHARS));
    }
    const repo = getNoteRepository();
    // get() loads the store on first touch (gist or disk) and returns the live items
    const existing = (await repo.get()).slice().sort((a, b) => a.id - b.id);
    // keep ids for reused chunks; only touch what actually changed
    let changed = 0;
    const keep = Math.min(existing.length, chunks.length);
    for (let i = 0; i < keep; i++) {
        if (existing[i].chunk !== chunks[i]) {
            existing[i].chunk = chunks[i];
            await repo.update(existing[i]);
            changed++;
        }
    }
    if (chunks.length > existing.length) {
        for (let i = keep; i < chunks.length; i++) {
            await repo.add({ chunk: chunks[i] });
            changed++;
        }
    }
    else if (existing.length > chunks.length) {
        for (let i = keep; i < existing.length; i++) {
            await repo.remove(existing[i].id);
            changed++;
        }
    }
    if (changed)
        log.info(`note saved: ${safe.length} chars in ${chunks.length} chunk(s) (${changed} chunk write(s))`);
    return { chars: safe.length, chunks: chunks.length };
}

"use strict";
/**
 * Memory-authoritative GitHub-Gist storage base.
 *
 * The in-memory array is the single source of truth; gists are the durable
 * write-behind store (flushed in batches). Reads therefore never touch the
 * network, ids are assigned synchronously, and a failed load never overwrites
 * stored data (batches are aborted until a full load succeeds).
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
const CryptoJS = require("crypto-js");
const logger_1 = require("../logger.js");
const FLUSH_INTERVAL_MS = parseInt(process.env.GIST_FLUSH_INTERVAL_MS || "5000", 10);
const LOAD_ATTEMPTS = parseInt(process.env.GIST_LOAD_ATTEMPTS || "8", 10);
const GITHUB_API = "https://api.github.com";
const log = (0, logger_1.default)(__filename);
/**
 * Room namespace — changing APP_ID in the env opens a different room on the
 * same GitHub account: every gist description is prefixed with `<APP_ID>_`,
 * so each distinct value addresses its own isolated set of gists.
 * (aliases appID / APPID are accepted; "default"/empty keeps the original
 * unprefixed naming so existing deployments stay untouched)
 */
function appNamespace() {
    const raw = String(process.env.APP_ID ?? process.env.appID ?? process.env.APPID ?? "").trim();
    const clean = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
    return !clean || clean.toLowerCase() === "default" ? "" : `${clean}_`;
}
const APP_NAMESPACE = appNamespace();
exports.APP_NAMESPACE = APP_NAMESPACE;
if (APP_NAMESPACE)
    log.info(`APP_ID namespace "${APP_NAMESPACE}" active — using a separate room (own gists)`);
class BaseGistRepository {
    credentials;
    modelName;
    encryptionPassword;
    /** authoritative items, kept sorted by id ascending */
    items = [];
    maxId = 0;
    loaded = false;
    loadPromise = null;
    flushBusy = false;
    flushTimer = null;
    constructor(credentials, modelName, encryptionPassword) {
        this.credentials = credentials;
        this.modelName = modelName;
        this.encryptionPassword = encryptionPassword || "";
    }
    // ---------- crypto ----------
    encrypt(data) {
        return CryptoJS.AES.encrypt(data, this.encryptionPassword).toString();
    }
    decrypt(encrypted) {
        const bytes = CryptoJS.AES.decrypt(encrypted, this.encryptionPassword);
        const text = bytes.toString(CryptoJS.enc.Utf8);
        if (!text)
            throw new Error("decryption produced empty output (wrong password or corrupted data)");
        return text;
    }
    // ---------- github api ----------
    async request(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            headers: {
                Authorization: `token ${this.credentials.token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": `${this.credentials.username || "bird-chat"}-storage`,
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
            signal: AbortSignal.timeout(30000),
        });
        return res;
    }
    async listGists() {
        const all = [];
        for (let page = 1; page <= 20; page++) {
            const res = await this.request(`${GITHUB_API}/users/${encodeURIComponent(this.credentials.username)}/gists?per_page=100&page=${page}`);
            if (!res.ok)
                throw new Error(`listing gists failed: ${res.status}`);
            const pageItems = await res.json();
            all.push(...pageItems);
            if (pageItems.length < 100)
                break;
        }
        return all;
    }
    async readGistFile(gistId, filename) {
        const res = await this.request(`${GITHUB_API}/gists/${gistId}`);
        if (!res.ok)
            throw new Error(`reading gist ${gistId} failed: ${res.status}`);
        const gist = await res.json();
        const file = gist.files && gist.files[filename];
        if (!file)
            return null;
        if (file.truncated)
            throw new Error(`gist ${gistId} file ${filename} is truncated (over the size limit) — aborting load to avoid data loss`);
        return file.content;
    }
    async createGist(description, filename, encrypted) {
        const res = await this.request(`${GITHUB_API}/gists`, {
            method: "POST",
            body: JSON.stringify({ description, public: false, files: { [filename]: { content: encrypted } } }),
        });
        if (!res.ok)
            throw new Error(`creating gist failed: ${res.status}`);
        const gist = await res.json();
        return gist.id;
    }
    async updateGist(gistId, filename, encrypted) {
        const res = await this.request(`${GITHUB_API}/gists/${gistId}`, {
            method: "PATCH",
            body: JSON.stringify({ files: { [filename]: { content: encrypted } } }),
        });
        if (!res.ok)
            throw new Error(`updating gist ${gistId} failed: ${res.status}`);
    }
    async deleteGist(gistId) {
        const res = await this.request(`${GITHUB_API}/gists/${gistId}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404)
            throw new Error(`deleting gist ${gistId} failed: ${res.status}`);
    }
    // ---------- loading ----------
    ensureLoaded() {
        if (this.loaded)
            return Promise.resolve();
        if (!this.loadPromise) {
            this.loadPromise = this.load()
                .then(() => {
                this.loaded = true;
                this.loadPromise = null;
            })
                .catch((err) => {
                this.loadPromise = null;
                throw err;
            });
        }
        return this.loadPromise;
    }
    /** default loading strategy: call loadOnce() with retries; reads/writes block until it succeeds */
    async load(attempts = LOAD_ATTEMPTS) {
        for (let i = 1; i <= attempts; i++) {
            try {
                await this.loadOnce();
                return;
            }
            catch (err) {
                log.error(`gist load attempt ${i}/${attempts} for ${this.modelName} failed: ${err.message}`);
                if (i === attempts)
                    throw err;
                await new Promise((r) => setTimeout(r, Math.min(i * 5, 30) * 1000));
            }
        }
    }
    // ---------- repository api ----------
    async get() {
        await this.ensureLoaded();
        return this.items;
    }
    async find(id) {
        await this.ensureLoaded();
        const idx = this.findIndex(id);
        return idx === -1 ? undefined : this.items[idx];
    }
    async add(item) {
        await this.ensureLoaded();
        this.maxId += 1;
        item.id = this.maxId;
        this.items.push(item);
        this.afterAdd(item);
        this.scheduleFlush();
        return item;
    }
    async update(item) {
        await this.ensureLoaded();
        const idx = this.findIndex(item.id);
        if (idx === -1)
            throw new Error("Item not found.");
        this.items[idx] = item;
        this.afterUpdate(item);
        this.scheduleFlush();
        return item;
    }
    async remove(id) {
        await this.ensureLoaded();
        const idx = this.findIndex(id);
        if (idx === -1)
            return false;
        this.items.splice(idx, 1);
        this.afterRemove(id);
        this.scheduleFlush();
        return true;
    }
    async removeAll() {
        await this.ensureLoaded();
        this.items = [];
        // maxId stays monotonic on purpose: never re-issue ids that older
        // clients may still hold in their caches
        this.afterRemoveAll();
        this.scheduleFlush();
    }
    findIndex(id) {
        let low = 0;
        let high = this.items.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const midId = this.items[mid].id;
            if (midId === id)
                return mid;
            if (midId < id)
                low = mid + 1;
            else
                high = mid - 1;
        }
        return -1;
    }
    // ---------- flushing ----------
    scheduleFlush() {
        if (this.flushTimer)
            return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flush().catch(() => { /* logged in flush() */ });
        }, FLUSH_INTERVAL_MS);
        if (this.flushTimer.unref)
            this.flushTimer.unref();
    }
    /** subclasses implement persistence of the dirty set */
    async flush() {
        throw new Error("not implemented");
    }
}
exports.BaseGistRepository = BaseGistRepository;

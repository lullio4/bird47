"use strict";
/**
 * Sharded memory-backed gist repository for the shared notepad (unlimited note).
 *
 * The note text is split by the caller (noteStore.js) into fixed-size chunks;
 * each chunk is one item here ({ id, chunk }). Every gist file holds one chunk,
 * so even a multi-megabyte note never approaches the ~1 MB per-file gist limit:
 * a 400,000-char chunk → ~405 KB raw JSON → ~540 KB encrypted base64 — safe.
 * The in-memory chunk array is authoritative; each flush rewrites only the
 * shards touched since the last flush (same write-behind model as the
 * message history shards).
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ShardedNoteRepository = void 0;
const logger_1 = require("../logger.js");
const BaseGistRepository_1 = require("./BaseGistRepository.js");
const log = (0, logger_1.default)(__filename);
// APP_ID room namespace — a non-empty value isolates the notepad in its own gists
const { APP_NAMESPACE } = BaseGistRepository_1;
// same per-shard budget as the message shards (raw JSON, before encryption overhead)
const SHARD_LIMIT = Math.max(parseInt(process.env.GIST_SHARD_BYTES || "500000", 10), 1000);
class ShardedNoteRepository extends BaseGistRepository_1.BaseGistRepository {
    /** [{ index, gistId, minId, maxId, sizeBytes }] sorted by index */
    shards = [];
    dirty = new Set();
    get descriptionPrefix() {
        return `${APP_NAMESPACE}Storage_${this.modelName}_`;
    }
    description(index) {
        return `${APP_NAMESPACE}Storage_${this.modelName}_${index}`;
    }
    filename(index) {
        return `${this.modelName.toLowerCase()}-data-${index}.json`;
    }
    // ---------- load ----------
    async loadOnce() {
        log.info(`loading ${this.modelName} from sharded gists...`);
        const gists = await this.listGists();
        const shardRe = new RegExp(`^${this.descriptionPrefix}(\\d+)$`);
        const mine = gists
            .map((g) => {
            const m = g.description && shardRe.exec(g.description);
            return m ? { index: Number(m[1]), gistId: g.id } : null;
        })
            .filter(Boolean)
            .sort((a, b) => a.index - b.index);
        const items = [];
        const shards = [];
        for (const shard of mine) {
            const content = await this.readGistFile(shard.gistId, this.filename(shard.index));
            if (content == null) {
                log.warn(`shard ${shard.index} has no file, skipping`);
                continue;
            }
            const parsed = JSON.parse(this.decrypt(content));
            const arr = Array.isArray(parsed) ? parsed : parsed[this.modelName];
            if (!Array.isArray(arr))
                throw new Error(`unexpected payload in shard ${shard.index}`);
            const ids = arr.map((x) => Number(x.id) || 0);
            items.push(...arr);
            shards.push({
                index: shard.index,
                gistId: shard.gistId,
                minId: ids.length ? Math.min(...ids) : 0,
                maxId: ids.length ? Math.max(...ids) : 0,
                sizeBytes: JSON.stringify({ [this.modelName]: arr }).length,
            });
        }
        // tolerate duplicate ids across shards (keep the later shard's copy)
        const byId = new Map();
        for (const it of items) {
            if (it && typeof it === "object" && it.id != null)
                byId.set(Number(it.id), it);
        }
        this.items = [...byId.values()].sort((a, b) => a.id - b.id);
        this.shards = shards;
        this.maxId = this.items.reduce((mx, it) => Math.max(mx, Number(it.id) || 0), this.maxId);
        log.info(`${this.modelName} loaded: ${this.items.length} chunk(s) across ${this.shards.length} shard(s)`);
    }
    // ---------- shard helpers ----------
    shardForId(id) {
        for (let i = this.shards.length - 1; i >= 0; i--) {
            const s = this.shards[i];
            if (id >= s.minId && id <= s.maxId)
                return s;
        }
        return this.shards[this.shards.length - 1] || null;
    }
    lastShard() {
        return this.shards[this.shards.length - 1] || null;
    }
    itemsInShard(shard) {
        return this.items.filter((it) => it.id >= shard.minId && it.id <= shard.maxId);
    }
    nextIndex() {
        return this.shards.length ? this.shards[this.shards.length - 1].index + 1 : 1;
    }
    // ---------- hooks ----------
    afterAdd(item) {
        const itemSize = JSON.stringify({ [this.modelName]: [item] }).length;
        let shard = this.lastShard();
        if (!shard || shard.sizeBytes + itemSize > SHARD_LIMIT) {
            shard = { index: this.nextIndex(), gistId: null, minId: item.id, maxId: item.id, sizeBytes: 0 };
            this.shards.push(shard);
        }
        shard.maxId = Math.max(shard.maxId, item.id);
        shard.sizeBytes += itemSize;
        this.dirty.add(shard.index);
    }
    afterUpdate(item) {
        const shard = this.shardForId(item.id);
        if (shard)
            this.dirty.add(shard.index);
    }
    afterRemove(id) {
        const shard = this.shardForId(id);
        if (shard)
            this.dirty.add(shard.index);
    }
    afterRemoveAll() {
        for (const shard of this.shards)
            this.deleteGist(shard.gistId).catch((err) => log.error(`deleting shard gist ${shard.gistId} failed: ${err.message}`));
        this.shards = [];
        this.dirty.clear();
    }
    // ---------- flush ----------
    async flush() {
        if (!this.dirty.size || this.flushBusy)
            return;
        this.flushBusy = true;
        try {
            while (this.dirty.size) {
                const index = this.dirty.values().next().value;
                this.dirty.delete(index);
                const shard = this.shards.find((s) => s.index === index);
                if (!shard)
                    continue;
                const arr = this.itemsInShard(shard);
                if (!arr.length) {
                    // shard drained by deletions — remove it entirely unless it's the only one
                    if (shard.gistId && this.shards.length > 1) {
                        await this.deleteGist(shard.gistId);
                        this.shards = this.shards.filter((s) => s.index !== index);
                        log.info(`empty shard ${index} deleted`);
                    }
                    continue;
                }
                const json = JSON.stringify({ [this.modelName]: arr });
                // chunks are pre-split by the caller, so a single chunk here can never
                // reach the gist file limit; this guard only catches misconfiguration
                // (NOTE_CHUNK_CHARS raised above the safe budget)
                if (json.length > 900000) {
                    log.error(`shard ${index} payload is ${json.length} bytes — too large for a gist file; skipping write (lower NOTE_CHUNK_CHARS)`);
                    continue;
                }
                shard.sizeBytes = json.length;
                const encrypted = this.encrypt(json);
                if (shard.gistId) {
                    await this.updateGist(shard.gistId, this.filename(index), encrypted);
                }
                else {
                    shard.gistId = await this.createGist(this.description(index), this.filename(index), encrypted);
                    log.info(`created shard ${index} gist ${shard.gistId}`);
                }
            }
        }
        catch (err) {
            log.error(`note flush failed (will retry): ${err.message}`);
            this.scheduleFlush();
        }
        finally {
            this.flushBusy = false;
        }
    }
}
exports.ShardedNoteRepository = ShardedNoteRepository;

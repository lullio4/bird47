"use strict";
/**
 * Sharded memory-backed gist repository for the (potentially large) Message model.
 *
 * GitHub gists cap a file at ~1MB, so the message history is split across
 * several secret gists (`Storage_Message_1`, `Storage_Message_2`, ...), each
 * holding a contiguous id range below SHARD_LIMIT bytes (raw JSON, before the
 * ~33% base64 encryption overhead). The in-memory array is authoritative;
 * each batch only rewrites the shards touched since the last flush.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ShardedGistMessageRepository = void 0;
const logger_1 = require("../logger.js");
const BaseGistRepository_1 = require("./BaseGistRepository.js");
const log = (0, logger_1.default)(__filename);
// APP_ID room namespace — a non-empty value isolates the history in its own gists
const { APP_NAMESPACE } = BaseGistRepository_1;
const SHARD_LIMIT = Math.max(parseInt(process.env.GIST_SHARD_BYTES || "500000", 10), 1000);
class ShardedGistMessageRepository extends BaseGistRepository_1.BaseGistRepository {
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
        log.info("loading message history from sharded gists...");
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
        log.info(`message history loaded: ${this.items.length} messages across ${this.shards.length} shard(s)`);
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
        let shard = this.lastShard();
        const itemSize = JSON.stringify({ [this.modelName]: [item] }).length;
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
                let json = JSON.stringify({ [this.modelName]: arr });
                // shard grew past the limit (large edits) — split by id halves
                if (json.length > SHARD_LIMIT && arr.length > 1) {
                    const mid = Math.floor(arr.length / 2);
                    const [a, b] = [arr.slice(0, mid), arr.slice(mid)];
                    const newShard = { index: this.nextIndex(), gistId: null, minId: b[0].id, maxId: b[b.length - 1].id, sizeBytes: JSON.stringify({ [this.modelName]: b }).length };
                    shard.maxId = a[a.length - 1].id;
                    shard.sizeBytes = JSON.stringify({ [this.modelName]: a }).length;
                    this.shards.push(newShard);
                    this.dirty.add(shard.index);
                    this.dirty.add(newShard.index);
                    log.info(`shard ${index} over limit, split into ${shard.index}+${newShard.index}`);
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
            log.error(`message flush failed (will retry): ${err.message}`);
            this.scheduleFlush();
        }
        finally {
            this.flushBusy = false;
        }
    }
}
exports.ShardedGistMessageRepository = ShardedGistMessageRepository;

"use strict";
/**
 * Single-gist memory-backed repository — used for the small models (User, Setting).
 * Compatible with the pre-existing gist format: description `Storage_<Model>`,
 * file `<model>-data.json`, content `{"<Model>": [...]}` (AES encrypted).
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MemoryGistRepository = void 0;
const logger_1 = require("../logger.js");
const BaseGistRepository_1 = require("./BaseGistRepository.js");
const log = (0, logger_1.default)(__filename);
// APP_ID room namespace — a non-empty value isolates this model in its own gist
const { APP_NAMESPACE } = BaseGistRepository_1;
class MemoryGistRepository extends BaseGistRepository_1.BaseGistRepository {
    gistId = null;
    dirty = false;
    get description() {
        return `${APP_NAMESPACE}Storage_${this.modelName}`;
    }
    get filename() {
        return `${this.modelName.toLowerCase()}-data.json`;
    }
    async loadOnce() {
        log.info(`loading ${this.modelName} from gist...`);
        const gists = await this.listGists();
        const mine = gists.find((g) => g.description === this.description ||
            (g.description && g.description.startsWith(this.description)));
        if (!mine) {
            log.info(`no existing gist for ${this.modelName}, starting empty`);
            this.items = [];
            return;
        }
        this.gistId = mine.id;
        const content = await this.readGistFile(mine.id, this.filename);
        if (content == null) {
            this.items = [];
            return;
        }
        const parsed = JSON.parse(this.decrypt(content));
        const arr = Array.isArray(parsed) ? parsed : parsed[this.modelName];
        if (!Array.isArray(arr))
            throw new Error(`unexpected gist payload for ${this.modelName}`);
        this.items = arr
            .filter((x) => x && typeof x === "object")
            .sort((a, b) => (a.id || 0) - (b.id || 0));
        this.maxId = this.items.reduce((mx, it) => Math.max(mx, Number(it.id) || 0), 0);
        log.info(`${this.modelName}: ${this.items.length} items loaded from gist`);
    }
    afterAdd() { this.dirty = true; }
    afterUpdate() { this.dirty = true; }
    afterRemove() { this.dirty = true; }
    afterRemoveAll() { this.dirty = true; }
    async flush() {
        if (!this.dirty || this.flushBusy)
            return;
        this.flushBusy = true;
        try {
            const payload = { [this.modelName]: this.items };
            const json = JSON.stringify(payload);
            if (json.length > 900000)
                log.warn(`${this.modelName} gist payload is ${json.length} bytes — nearing the 1MB gist file limit`);
            const encrypted = this.encrypt(json);
            if (this.gistId) {
                await this.updateGist(this.gistId, this.filename, encrypted);
            }
            else {
                this.gistId = await this.createGist(this.description, this.filename, encrypted);
            }
            this.dirty = false;
        }
        catch (err) {
            log.error(`flush of ${this.modelName} failed (will retry): ${err.message}`);
            this.scheduleFlush();
        }
        finally {
            this.flushBusy = false;
        }
    }
}
exports.MemoryGistRepository = MemoryGistRepository;

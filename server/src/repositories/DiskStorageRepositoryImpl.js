"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DiskStorageRepositoryImpl = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = __importDefault(require("../logger.js"));
const paths_1 = require("../paths.js");
// APP_ID room namespace (same semantics as the gist repositories — a separate
// room gets its own data files); empty for the default room
const { APP_NAMESPACE } = require("./BaseGistRepository.js");
// data folder is resolved from the project root (or DATA_DIR env), never the CWD
const DATA_FOLDER = paths_1.DATA_DIR;
const log = (0, logger_1.default)(__filename);
class DiskStorageRepositoryImpl {
    modelName;
    filePath;
    /** track of maximum id assigned to item in items */
    maxId = 0;
    items = [];
    /** boolean flag to track incoming write request while we are writing to disk */
    moreWriteRequest = false;
    /** boolean flag to make sure file writing is done by one person at a time */
    fileWriteBusy = false;
    constructor(modelName) {
        this.modelName = modelName;
        this.filePath = path.join(DATA_FOLDER, `${APP_NAMESPACE}${this.modelName}.json`);
        this.assertDataFolderExists();
        this.loadFromFile();
    }
    assertDataFolderExists() {
        if (!fs.existsSync(DATA_FOLDER)) {
            fs.mkdirSync(DATA_FOLDER, { recursive: true });
        }
    }
    loadFromFile() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, "utf8");
                this.items = JSON.parse(data);
                this.items.forEach(item => this.maxId = Math.max(this.maxId, item.id));
                log.info(`data loaded from ${this.filePath}`);
            }
            else {
                log.info(`${this.filePath} doesn't exist, fresh file will be created!`);
                this.items = [];
            }
        }
        catch (error) {
            log.error(error);
            // A corrupted file must never be silently wiped: keep it aside for recovery.
            const backup = `${this.filePath}.corrupt-${Date.now()}`;
            try {
                fs.renameSync(this.filePath, backup);
                log.error(`corrupted ${this.filePath} moved to ${backup} — starting empty`);
            }
            catch {
                log.error(`corrupted ${this.filePath} could not be moved — starting empty`);
            }
            this.items = [];
        }
    }
    saveToFile() {
        if (this.fileWriteBusy) {
            log.debug("more request incoming while writing to disk");
            this.moreWriteRequest = true;
            return;
        }
        this.fileWriteBusy = true;
        this.moreWriteRequest = false;
        const spacePadding = process.env.NODE_ENV === "development" ? 2 : 0;
        const data = JSON.stringify(this.items, null, spacePadding);
        // atomic write: write to a temp file first, then rename over the target,
        // so a crash mid-write can never corrupt the stored data
        const tmpPath = `${this.filePath}.tmp`;
        fs.writeFile(tmpPath, data, { encoding: "utf8" }, (err) => {
            if (err) {
                this.fileWriteBusy = false;
                log.error(`write failed ${this.filePath}, msg: ${err?.message}, code: ${err?.code}, path: ${err?.path} `);
                if (this.moreWriteRequest)
                    this.saveToFile();
                return;
            }
            fs.rename(tmpPath, this.filePath, (renameErr) => {
                this.fileWriteBusy = false;
                if (renameErr) {
                    log.error(`rename failed ${tmpPath} -> ${this.filePath}: ${renameErr?.message}`);
                }
                if (this.moreWriteRequest)
                    this.saveToFile();
            });
        });
    }
    add = async (item) => {
        this.maxId = this.maxId + 1;
        item.id = this.maxId;
        this.items.push(item);
        this.saveToFile();
        return item;
    };
    get = async () => {
        return this.items;
    };
    findIndex(id) {
        let low = 0;
        let high = this.items.length;
        let mid;
        while (high >= low) {
            mid = Math.trunc((low + high) / 2);
            if (this.items[mid].id === id)
                return mid;
            if (this.items[mid].id < id)
                low = mid + 1;
            else
                high = mid - 1;
        }
        return -1;
    }
    find = async (id) => {
        const indx = this.findIndex(id);
        if (indx == -1)
            return undefined;
        return this.items[indx];
    };
    update = async (item) => {
        const index = this.findIndex(item.id);
        if (index !== -1) {
            this.items[index] = item;
            this.saveToFile();
            return item;
        }
        throw new Error("Item not found.");
    };
    remove = async (id) => {
        const index = this.findIndex(id);
        if (index !== -1) {
            this.items.splice(index, 1);
            this.saveToFile();
            return true;
        }
        return false;
    };
    removeAll = async () => {
        this.items = []; // clear all items
        this.maxId = 0;
        this.saveToFile(); // save
    };
}
exports.DiskStorageRepositoryImpl = DiskStorageRepositoryImpl;

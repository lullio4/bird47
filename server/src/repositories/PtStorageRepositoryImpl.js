"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PtStorageRepositoryImpl = void 0;
const ClientError_1 = require("../models/ClientError.js");
const logger_1 = __importDefault(require("../logger.js"));
const log = (0, logger_1.default)(__filename);
// eslint-disable-next-line @typescript-eslint/no-var-requires
// required lazily so the optional dependency never breaks startup
function getProtectedTextAPI() {
    try {
        return require("protectedtext-api"); // import "protectedtext-api" not works
    }
    catch (err) {
        throw ClientError_1.ClientError.connectionFailedError();
    }
}
// Function to load the tab manager for the site
async function loadTabManager(siteId, sitePassword) {
    try {
        const api = new (getProtectedTextAPI())(siteId, sitePassword);
        const tabManager = await api.loadTabs();
        return tabManager;
    }
    catch (error) {
        log.error("Error loading tabs:", error);
        throw ClientError_1.ClientError.connectionFailedError();
    }
}
class PtStorageRepositoryImpl {
    cachedItems = [];
    siteId = "";
    sitePassword = "";
    tabManager = null;
    modelName;
    constructor(siteId, sitePassword, modelName) {
        this.siteId = siteId;
        this.sitePassword = sitePassword;
        this.modelName = modelName;
    }
    // Add a item to the repository
    async add(item) {
        const items = await this.getItems();
        let maxId = 0;
        items.forEach((item) => (maxId = Math.max(maxId, item.id)));
        item.id = maxId + 1;
        items.push(item);
        await this.saveItems(items);
        return item;
    }
    // Get items from cache or load from tab manager
    async getItems() {
        if (this.cachedItems.length) {
            return this.cachedItems; // return cached items
        }
        if (this.tabManager == null) {
            log.info("loading pt tab manager... please be patient!");
            this.tabManager = await loadTabManager(this.siteId, this.sitePassword);
        }
        try {
            const storage = await this.getFullStorage();
            const items = storage[this.modelName];
            if (items) {
                this.cachedItems = items;
            }
            return this.cachedItems;
        }
        catch (e) {
            throw new Error(`Error parsing JSON: ${e}`);
        }
    }
    // Get all items from the repository
    async get() {
        return this.getItems();
    }
    find = async (id) => {
        const items = await this.getItems();
        return items.find((item) => item.id == id);
    };
    // Update a item in the repository
    async update(item) {
        const items = await this.getItems();
        const updatedItems = items.map((existingItem) => {
            if (existingItem.id === item.id) {
                return item;
            }
            return existingItem;
        });
        await this.saveItems(updatedItems);
        return item;
    }
    // Remove a item from the repository
    async remove(itemId) {
        const items = await this.getItems();
        const filtereditems = items.filter((item) => item.id !== itemId);
        await this.saveItems(filtereditems);
        return true;
    }
    // Save items to tab manager and update cache
    async saveItems(items) {
        const oldStorage = await this.getFullStorage();
        oldStorage[this.modelName] = items;
        const updatedStorage = JSON.stringify(oldStorage);
        if (this.tabManager == null) {
            log.info("loading pt tab manager... please be patient!");
            this.tabManager = await loadTabManager(this.siteId, this.sitePassword);
        }
        await this.tabManager.save(updatedStorage);
        this.cachedItems = items; // update cache
    }
    async getFullStorage() {
        try {
            const oldText = await this.tabManager.view();
            const oldStorage = JSON.parse(oldText);
            return oldStorage;
        }
        catch (error) {
            await this.tabManager.save("{}");
            return {};
        }
    }
}
exports.PtStorageRepositoryImpl = PtStorageRepositoryImpl;

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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueuedGitHubGistRepository = void 0;
const CryptoJS = __importStar(require("crypto-js"));
class QueuedGitHubGistRepository {
    credentials;
    encryptionPassword;
    modelName;
    gistId = null;
    // Queue system
    operationQueue = [];
    isProcessing = false;
    batchInterval = 5000; // 5 seconds
    maxBatchSize = 100; // Max operations per batch
    // No caching - always load fresh data from GitHub
    // Statistics
    stats = {
        totalOperations: 0,
        batchesProcessed: 0,
        lastBatchTime: 0,
        queueLength: 0
    };
    constructor(credentials, modelName, encryptionPassword) {
        this.credentials = credentials;
        this.modelName = modelName;
        this.encryptionPassword = encryptionPassword;
        console.log(`🚀 Queued GitHub Gist Repository: ${modelName}`);
        // Start background batch processor
        this.startBatchProcessor();
        // No initial data loading needed - will load on-demand
    }
    /**
     * Background batch processor - runs every few seconds
     */
    startBatchProcessor() {
        setInterval(async () => {
            if (this.operationQueue.length > 0 && !this.isProcessing) {
                await this.processBatch();
            }
        }, this.batchInterval);
        console.log(`📦 Batch processor started (${this.batchInterval / 1000}s interval)`);
    }
    /**
     * Process all queued operations in a single batch
     */
    async processBatch() {
        if (this.isProcessing) {
            return { success: false, operationsProcessed: 0, error: 'Already processing' };
        }
        this.isProcessing = true;
        const startTime = Date.now();
        try {
            // Get operations to process
            const operations = this.operationQueue.splice(0, this.maxBatchSize);
            if (operations.length === 0) {
                this.isProcessing = false;
                return { success: true, operationsProcessed: 0 };
            }
            console.log(`📦 Processing batch: ${operations.length} operations`);
            // Load current data from GitHub
            let currentData = await this.loadFromGist();
            // Apply all operations in order
            let mergedData = [...currentData];
            let operationsApplied = 0;
            for (const operation of operations) {
                try {
                    mergedData = this.applyOperation(mergedData, operation);
                    operationsApplied++;
                    console.log(`  ✅ Applied ${operation.type} operation (${operation.id})`);
                }
                catch (error) {
                    console.error(`  ❌ Failed to apply operation ${operation.id}:`, error.message);
                }
            }
            // No cache to update - data will be loaded fresh next time
            // Always try to save to GitHub Gist (let GitHub handle duplicate detection)
            let gistId = this.gistId || '';
            try {
                gistId = await this.saveToGist(mergedData);
            }
            catch (error) {
                console.error('❌ Failed to save to gist:', error.message);
                // Continue processing - cache is already updated with correct data
            }
            // Update statistics
            this.stats.totalOperations += operationsApplied;
            this.stats.batchesProcessed++;
            this.stats.lastBatchTime = Date.now();
            this.stats.queueLength = this.operationQueue.length;
            const processingTime = Date.now() - startTime;
            console.log(`✅ Batch completed: ${operationsApplied} operations in ${processingTime}ms`);
            return {
                success: true,
                operationsProcessed: operationsApplied,
                gistId
            };
        }
        catch (error) {
            console.error('❌ Batch processing failed:', error.message);
            return {
                success: false,
                operationsProcessed: 0,
                error: error.message
            };
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Apply a single operation to the data array
     */
    applyOperation(data, operation) {
        const result = [...data];
        switch (operation.type) {
            case 'add':
                if (operation.data) {
                    // Generate ID if missing (during batch processing to ensure uniqueness)
                    if (!operation.data.id || operation.data.id === 0 || operation.data.id === -1) {
                        const maxId = result.length > 0
                            ? Math.max(...result.map(i => i.id || 0))
                            : 0;
                        operation.data.id = maxId + 1;
                    }
                    // Check for duplicates by ID and other fields
                    const exists = result.find(item => item.id === operation.data.id ||
                        this.isDuplicate(item, operation.data));
                    if (!exists) {
                        result.push(operation.data);
                    }
                    else {
                        console.log(`  ⚠️ Skipping duplicate add for ${operation.data.id} (${operation.data.id ? 'ID' : 'content'})`);
                    }
                }
                break;
            case 'update':
                if (operation.data) {
                    const index = result.findIndex(item => item.id === operation.data.id);
                    if (index >= 0) {
                        result[index] = { ...result[index], ...operation.data };
                    }
                }
                break;
            case 'remove':
                if (operation.itemId) {
                    const index = result.findIndex(item => item.id === operation.itemId);
                    if (index >= 0) {
                        result.splice(index, 1);
                    }
                }
                break;
            case 'removeAll':
                return [];
        }
        return result;
    }
    /**
     * Check if two items are duplicates (customize based on your model)
     */
    isDuplicate(item1, item2) {
        // Skip if either item has temporary ID (-1) or no ID
        if (!item1.id || !item2.id || item1.id === -1 || item2.id === -1) {
            // Check by unique fields for new items
            if ('username' in item1 && 'username' in item2) {
                return item1.username === item2.username;
            }
            if ('email' in item1 && 'email' in item2) {
                return item1.email === item2.email;
            }
            if ('name' in item1 && 'name' in item2) {
                return item1.name === item2.name;
            }
        }
        // For items with real IDs, only compare IDs
        return item1.id === item2.id && item1.id !== -1;
    }
    /**
     * Queue an operation for batch processing
     */
    queueOperation(operation) {
        const queuedOp = {
            ...operation,
            id: `${operation.type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            timestamp: Date.now()
        };
        this.operationQueue.push(queuedOp);
        this.stats.queueLength = this.operationQueue.length;
        console.log(`📝 Queued ${operation.type} operation (Queue: ${this.operationQueue.length})`);
        // Process immediately if queue is getting large
        if (this.operationQueue.length >= this.maxBatchSize && !this.isProcessing) {
            this.processBatch().catch(console.error);
        }
    }
    // GitHub API helpers
    async makeGitHubRequest(url, options = {}) {
        const headers = {
            'Authorization': `token ${this.credentials.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': `${this.credentials.username}-storage-app`,
            ...options.headers
        };
        return fetch(url, { ...options, headers });
    }
    // Encryption helpers
    encrypt(data) {
        return CryptoJS.AES.encrypt(data, this.encryptionPassword).toString();
    }
    decrypt(encryptedData) {
        const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionPassword);
        return bytes.toString(CryptoJS.enc.Utf8);
    }
    // Find our storage gist
    async findStorageGist() {
        try {
            const response = await this.makeGitHubRequest(`https://api.github.com/users/${this.credentials.username}/gists`);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            const gists = await response.json();
            const storageGist = gists.find(gist => gist.description === `Storage_${this.modelName}` ||
                gist.description.includes(`Storage_${this.modelName}`));
            return storageGist || null;
        }
        catch (error) {
            console.error('❌ Failed to find storage gist:', error.message);
            return null;
        }
    }
    // Load data from GitHub Gist
    async loadFromGist() {
        try {
            // Find existing gist if we don't have the ID
            if (!this.gistId) {
                const gist = await this.findStorageGist();
                if (gist) {
                    this.gistId = gist.id;
                }
                else {
                    return [];
                }
            }
            // Read gist content
            const response = await this.makeGitHubRequest(`https://api.github.com/gists/${this.gistId}`);
            if (!response.ok) {
                throw new Error(`Failed to read gist: ${response.status}`);
            }
            const gist = await response.json();
            const filename = `${this.modelName.toLowerCase()}-data.json`;
            const file = gist.files[filename];
            if (!file) {
                return [];
            }
            const decrypted = this.decrypt(file.content);
            const allData = JSON.parse(decrypted);
            return allData[this.modelName] || [];
        }
        catch (error) {
            console.error('❌ Failed to load from gist:', error.message);
            return [];
        }
    }
    // Save data to GitHub Gist
    async saveToGist(data) {
        const allData = { [this.modelName]: data };
        const jsonData = JSON.stringify(allData, null, 2);
        const encrypted = this.encrypt(jsonData);
        const filename = `${this.modelName.toLowerCase()}-data.json`;
        try {
            if (this.gistId) {
                // Update existing gist
                const updateData = {
                    files: {
                        [filename]: {
                            content: encrypted
                        }
                    }
                };
                const response = await this.makeGitHubRequest(`https://api.github.com/gists/${this.gistId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updateData)
                });
                if (!response.ok) {
                    throw new Error(`Failed to update gist: ${response.status}`);
                }
                console.log(`💾 ${this.modelName} data updated in GitHub Gist: ${this.gistId}`);
                console.log(`🔗 View at: https://gist.github.com/${this.credentials.username}/${this.gistId}`);
            }
            else {
                // Create new gist
                const gistData = {
                    description: `Storage_${this.modelName}`,
                    public: false,
                    files: {
                        [filename]: {
                            content: encrypted
                        }
                    }
                };
                const response = await this.makeGitHubRequest('https://api.github.com/gists', {
                    method: 'POST',
                    body: JSON.stringify(gistData)
                });
                if (!response.ok) {
                    throw new Error(`Failed to create gist: ${response.status}`);
                }
                const gist = await response.json();
                this.gistId = gist.id;
                console.log(`💾 ${this.modelName} data saved to GitHub Gist: ${gist.id}`);
                console.log(`🔗 View at: ${gist.html_url}`);
            }
            return this.gistId;
        }
        catch (error) {
            console.error('❌ Failed to save to gist:', error.message);
            throw error;
        }
    }
    // No cache management needed - always load fresh data
    // StorageRepository interface implementation
    async get() {
        // Always load fresh data from GitHub Gist
        return await this.loadFromGist();
    }
    async add(item) {
        // DON'T generate ID here - let batch processor handle it to avoid duplicates
        // Just queue the operation with the original item
        const clonedItem = { ...item };
        this.queueOperation({
            type: 'add',
            data: clonedItem
        });
        // Return item with temporary ID for immediate use
        // Real ID will be assigned during batch processing
        if (!clonedItem.id || clonedItem.id === 0) {
            clonedItem.id = -1; // Temporary placeholder
        }
        return clonedItem;
    }
    async update(item) {
        this.queueOperation({
            type: 'update',
            data: item
        });
        return item;
    }
    async remove(id) {
        this.queueOperation({
            type: 'remove',
            itemId: id
        });
        return true;
    }
    async removeAll() {
        this.queueOperation({
            type: 'removeAll'
        });
    }
    async find(id) {
        const items = await this.get();
        return items.find(item => item.id === id);
    }
    // Queue management methods
    /**
     * Force immediate processing of queue
     */
    async flush() {
        return await this.processBatch();
    }
    /**
     * Get queue statistics
     */
    getQueueStats() {
        return {
            ...this.stats,
            queueLength: this.operationQueue.length,
            isProcessing: this.isProcessing,
            cacheValid: false, // No caching
            nextBatchIn: this.batchInterval - (Date.now() - this.stats.lastBatchTime)
        };
    }
    /**
     * Configure batch processing
     */
    setBatchConfig(intervalMs, maxBatchSize) {
        this.batchInterval = intervalMs;
        this.maxBatchSize = maxBatchSize;
        console.log(`📦 Batch config updated: ${intervalMs}ms interval, ${maxBatchSize} max operations`);
    }
    /**
     * Get GitHub API rate limit status
     */
    async getRateLimitStatus() {
        try {
            const response = await this.makeGitHubRequest('https://api.github.com/rate_limit');
            const data = await response.json();
            console.log(`📊 GitHub API Rate Limit: ${data.core.remaining}/${data.core.limit} requests remaining`);
            return data;
        }
        catch (error) {
            console.error('❌ Failed to get rate limit status:', error.message);
            return null;
        }
    }
}
exports.QueuedGitHubGistRepository = QueuedGitHubGistRepository;
/**
 * Usage Example:
 *
 * const credentials = {
 *   token: 'ghp_your_personal_access_token',
 *   username: 'your_github_username'
 * };
 *
 * const userRepo = new QueuedGitHubGistRepository<User>(
 *   credentials,
 *   'User',
 *   'your_encryption_password'
 * );
 *
 * // All operations are instant (queued)
 * await userRepo.add({ name: 'John' });    // Returns immediately
 * await userRepo.add({ name: 'Jane' });    // Returns immediately
 * await userRepo.add({ name: 'Bob' });     // Returns immediately
 *
 * // All 3 users will be saved together in next batch (5 seconds)
 * // No race conditions, no data loss!
 *
 * // Check queue status
 * console.log(userRepo.getQueueStats());
 *
 * // Force immediate save
 * await userRepo.flush();
 *
 * // Check GitHub rate limits
 * await userRepo.getRateLimitStatus();
 */ 

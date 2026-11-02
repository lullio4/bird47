"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getUserRepository = getUserRepository;
exports.getMessageRepository = getMessageRepository;
exports.getSettingRepository = getSettingRepository;
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const Storage_1 = require("../models/storageTypes.js");
const DiskStorageRepositoryImpl_1 = require("../repositories/DiskStorageRepositoryImpl.js");
const PtStorageRepositoryImpl_1 = require("../repositories/PtStorageRepositoryImpl.js");
const MemoryGistRepository_1 = require("../repositories/MemoryGistRepository.js");
const ShardedGistMessageRepository_1 = require("../repositories/ShardedGistMessageRepository.js");
const log = (0, logger_1.default)(__filename);
// singeleton idea:
// https://stackoverflow.com/questions/1479319/simplest-cleanest-way-to-implement-a-singleton-in-javascript
function getRepository(storageModel, storageType) {
    let repository = null;
    if (!repository) {
        log.info(`initializing repository for model  ${storageModel}`);
        try {
            switch (storageType) {
                case Storage_1.StorageTypes.ptStorage: {
                    log.info(`Pt has been chosen as the default repository for: ${storageModel}`);
                    const siteId = process.env.PT_SITE_ID ?? "";
                    const sitePassword = process.env.PT_SITE_PASSWORD ?? "";
                    repository = new PtStorageRepositoryImpl_1.PtStorageRepositoryImpl(siteId, sitePassword, storageModel);
                    break;
                }
                case Storage_1.StorageTypes.diskStorage:
                    log.info(`Disk Storage has been chosen as the default repository for: ${storageModel}`);
                    repository = new DiskStorageRepositoryImpl_1.DiskStorageRepositoryImpl(storageModel);
                    break;
                case Storage_1.StorageTypes.githubGistStorage: {
                    log.info(`githubGist Storage has been chosen as the repository for: ${storageModel}`);
                    const githubGist_token = process.env.githubGist_token ?? "";
                    const githubGist_username = process.env.githubGist_username ?? "";
                    const encryption_password = process.env.encryption_password ?? "";
                    if (!githubGist_token || !githubGist_username) {
                        log.error("githubGist_token / githubGist_username env vars are required for githubGistStorage");
                        break;
                    }
                    const credentials = { token: githubGist_token, username: githubGist_username };
                    // messages grow without bound → sharded gists; User/Setting stay single-file
                    repository = storageModel === Storage_1.StorageModels.Message
                        ? new ShardedGistMessageRepository_1.ShardedGistMessageRepository(credentials, storageModel, encryption_password)
                        : new MemoryGistRepository_1.MemoryGistRepository(credentials, storageModel, encryption_password);
                    break;
                }
                default:
                    log.error(`Invalid repository name: ${storageType}`);
            }
        }
        catch (error) {
            log.error(`Error creating repository: ${error.message}`);
        }
    }
    if (!repository) {
        log.error("Could not instantiate repository");
        // we throw a "connection failed" error, since we have observed that
        // such errors can be caused by connection issues.
        throw ClientError_1.ClientError.connectionFailedError();
    }
    return repository;
}
const defaultStorage = process.env.REPOSITORY_NAME || Storage_1.StorageTypes.diskStorage;
// messages may live on a different backend than users/settings
const messageStorage = process.env.MESSAGE_REPOSITORY || defaultStorage;
let messageRepository;
let settingRepository;
let userRepository;
function getUserRepository() {
    if (!userRepository) {
        userRepository = getRepository(Storage_1.StorageModels.User, defaultStorage);
    }
    return userRepository;
}
function getMessageRepository() {
    if (!messageRepository) {
        messageRepository = getRepository(Storage_1.StorageModels.Message, messageStorage);
    }
    return messageRepository;
}
function getSettingRepository() {
    if (!settingRepository) {
        settingRepository = getRepository(Storage_1.StorageModels.Setting, defaultStorage);
    }
    return settingRepository;
}

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
exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcryptjs"));
const ClientError_1 = require("../models/ClientError.js");
const UserDto_1 = require("../dto/UserDto.js");
const userCrudService = __importStar(require("./userCrudService.js"));
const logger_1 = __importDefault(require("../logger.js"));
const config_1 = require("../config/repositoryFactory.js");
const log = (0, logger_1.default)(__filename);
const login = async (user) => {
    if (!user.isValidCredentials())
        throw ClientError_1.ClientError.invalidCredentials();
    log.debug("login called");
    const result = await userCrudService.getUserByUserName(user.username);
    if (!result || result.length != 1)
        throw ClientError_1.ClientError.notExistsError();
    if (!result[0].active) {
        log.debug("login failed, User Inactive");
        throw ClientError_1.ClientError.inactiveUser();
    }
    const compare = await comparePass(user.password, result[0].password);
    if (!compare)
        throw ClientError_1.ClientError.WrongPassword();
    const userDto = new UserDto_1.UserDto(result[0] // returns user model
    ); // returns user dto
    result[0].lastLoginDate = new Date().toISOString();
    await (0, config_1.getUserRepository)().update(result[0]);
    return userDto;
};
exports.login = login;
const comparePass = async (plainTextPass, hashPass) => {
    if (!plainTextPass && !hashPass)
        throw new Error("Empty plainTextPass or hashPass");
    return await bcrypt_1.default.compare(plainTextPass, hashPass);
};

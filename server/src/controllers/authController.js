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
exports.setSession = exports.logout = exports.login = void 0;
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const authService = __importStar(require("../services/authService.js"));
const UserDto_1 = require("../dto/UserDto.js");
const www_1 = require("../www.js");
const log = (0, logger_1.default)(__filename);
const login = async (req, res) => {
    const username = req.body.username;
    const userPass = req.body.password;
    if (!username || !userPass) {
        return res.sendStatus(400);
    }
    const userDto = new UserDto_1.UserDto({
        username: username,
        password: userPass,
    });
    try {
        // keeping here to handle errors if any
        const user = await authService.login(userDto);
        await setSession(req, user);
        req.session.authenticated = true;
        res.sendStatus(200);
    }
    catch (error) {
        if (error instanceof ClientError_1.ClientError) {
            res.status(400).json({
                message: error.message
            });
        }
        else {
            log.error(error);
            res.sendStatus(500);
        }
    }
};
exports.login = login;
const logout = async (req, res) => {
    if (!req.session.userInfo || !req.session.userInfo.username)
        return res.sendStatus(403);
    try {
        // first destroy socket session
        (0, www_1.destroySocketSession)(req.session.id);
        // now destroy express session
        await destroySession(req);
        res.status(200).json({
            message: "Logout Successfull",
        });
    }
    catch (error) {
        let message = "";
        if (error instanceof Error) {
            log.error(error.message);
            message = error.message;
        }
        res.status(400).send(message);
    }
};
exports.logout = logout;
const setSession = async (req, user) => {
    if (!user.username) {
        log.error("user.username is missing");
        throw ClientError_1.ClientError.invalidError();
    }
    // regenerate the session id on login to prevent session fixation
    await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.userInfo = new UserDto_1.SessionUser(user.id, user.username, user.langPref, user.active, user.isAdmin, user.soundPref, user.mustChangePassword === true, Date.now());
    req.session.authenticated = true;
    await new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    log.debug(`login sessionId: ${req.sessionID}`);
};
exports.setSession = setSession;
const destroySession = async (req) => {
    if (!req.session) {
        log.error("req.session is missing");
        throw ClientError_1.ClientError.invalidError();
    }
    log.debug(`before logout sessionId: ${req.sessionID}`);
    req.session.destroy(function (err) {
        if (err)
            log.error(err);
    });
    log.debug(`after logout sessionId: ${req.sessionID}`);
};

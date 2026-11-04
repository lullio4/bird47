"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.exportChat = exports.reactMessage = exports.getMissingMessages = exports.getMessages = void 0;
const socketService_1 = require("../socket/socketService.js");
const SocketEvents_1 = require("../socket/socketEvents.js");
const socketEvents_1 = require("../socket/socketEvents.js");
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const config_1 = require("../config/repositoryFactory.js");
const chatService_1 = require("../services/chatService.js");
const permissions_1 = require("../services/permissions.js");
const log = (0, logger_1.default)(__filename);
const clampLimit = (value) => {
    const n = parseInt(String(value ?? ""), 10);
    if (Number.isNaN(n))
        return 20;
    return Math.min(Math.max(n, 1), 100);
};
const getMessages = async (req, res) => {
    try {
        const repository = (0, config_1.getMessageRepository)();
        const limit = clampLimit(req.body?.limit);
        const lastIdRaw = req.body?.lastId;
        const messages = await repository.get();
        let fetchedMessages;
        let hasMore;
        if (lastIdRaw === null || lastIdRaw === undefined) {
            // Initial fetch: get the last `limit` messages
            fetchedMessages = messages.slice(Math.max(messages.length - limit, 0));
            hasMore = messages.length > fetchedMessages.length;
        }
        else {
            // Subsequent fetch: pages are anchored on message ids, not array
            // positions, so deleting messages can never shift/skip history
            const lastId = Number(lastIdRaw);
            if (Number.isNaN(lastId)) {
                res.status(400).json({ errorMessage: "client_error.invalid_error" });
                return;
            }
            let cursor = messages.length;
            while (cursor > 0 && messages[cursor - 1].id >= lastId)
                cursor--;
            const start = Math.max(cursor - limit, 0);
            fetchedMessages = messages.slice(start, cursor);
            hasMore = start > 0;
        }
        const response = {
            messages: fetchedMessages,
            hasMore,
        };
        res.status(200).json(response);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getMessages = getMessages;
const getMissingMessages = async (req, res) => {
    try {
        const repository = (0, config_1.getMessageRepository)();
        const messages = await repository.get();
        const expectedId = Number(req.body?.expectedId ?? 0);
        if (Number.isNaN(expectedId)) {
            res.status(400).json({ errorMessage: "client_error.invalid_error" });
            return;
        }
        // Find the missing messages in the repository from the sequence ID to the latest sequence
        const missingMessages = messages.filter((msg) => {
            return msg.id >= expectedId;
        });
        res.status(200).json(missingMessages.reverse());
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getMissingMessages = getMissingMessages;
/**
 * GET /api/chat/export?format=txt|html|json&lang=bn|en
 * Full-history export for every logged-in user (unless the admin restricted
 * the copy feature to admins via /api/chat/admin-settings).
 * txt = clean plain text (HTML stripped), html = rich rendering exactly like
 * the chat shows it, json = raw data (reactions, edits, ...)
 */
const exportChat = async (req, res) => {
    try {
        // the admin may restrict the export feature to admins or to a hand-picked
        // list of users ("selected"); admins always keep access
        const settings = await (0, config_1.getSettingRepository)().get();
        if (!(0, permissions_1.canUseCopyAll)(settings[0], req.session?.userInfo)) {
            return res.status(403).json({ message: "client_error.admin_only" });
        }
        const format = ["json", "html"].includes(req.query?.format) ? req.query.format : "txt";
        const lang = req.query?.lang === "en" ? "en" : "bn";
        if (format === "json") {
            const data = await (0, chatService_1.buildExportJson)();
            res.setHeader("Content-Disposition", 'inline; filename="chat-export.json"');
            res.status(200).json(data);
        }
        else if (format === "html") {
            const html = await (0, chatService_1.buildExportHtml)(lang);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Content-Disposition", 'inline; filename="chat-export.html"');
            res.status(200).send(html);
        }
        else {
            const text = await (0, chatService_1.buildExportTxt)(lang);
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Content-Disposition", 'inline; filename="chat-export.txt"');
            res.status(200).send(text);
        }
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.exportChat = exportChat;
/**
 * REST twin of the socket "reactMessage" handler (server/src/socket/chatHandler.js):
 * the addon's custom-emoji picker sends through the SAME http path as every
 * other addon call — no second websocket needed; the UI still updates through
 * the app's own socket via the reactedMessage broadcast (sender included).
 */
const reactMessage = async (req, res) => {
    try {
        const reactedMessage = req.body || {};
        if (!reactedMessage?.id)
            throw ClientError_1.ClientError.invalidError();
        const repository = (0, config_1.getMessageRepository)();
        const message = await repository.find(reactedMessage.id);
        // mirror the socket handler: a missing message falls into the same
        // catch → internalError (500) — NOT invalidError (400)
        if (!message)
            throw new Error("message not found");
        const curUserName = req.session?.userInfo?.username;
        if (!curUserName)
            throw ClientError_1.ClientError.accessDeniedError();
        if (!message.reactions || typeof message.reactions !== "object")
            message.reactions = {};
        for (const emoji of Object.keys(reactedMessage.reactions || {})) {
            const incoming = reactedMessage.reactions[emoji];
            // tolerate malformed payloads (mirrors the socket handler)
            if (!incoming || !Array.isArray(incoming.usernames))
                continue;
            if (!message.reactions[emoji] || !Array.isArray(message.reactions[emoji].usernames))
                message.reactions[emoji] = { usernames: [] };
            const userList = message.reactions[emoji].usernames;
            const foundUsr = incoming.usernames.find((usrname) => usrname == curUserName);
            const curUsr = userList.find((usrname) => usrname == curUserName);
            if (foundUsr && !curUsr)
                userList.push(curUserName);
            else if (!foundUsr && curUsr)
                message.reactions[emoji].usernames = userList.filter((usr) => usr != curUserName);
        }
        reactedMessage.reactions = message.reactions;
        await repository.update(message);
        res.status(200).json(reactedMessage);
        // same broadcast the socket path uses — the app's own socket (and every
        // other client) applies the new reaction live; sender included
        const io = (0, socketService_1.getLiveIo)();
        if (io)
            io.emit(SocketEvents_1.socketEvents.reactedMessage, reactedMessage);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.reactMessage = reactMessage;
/**
 * Handles errors and sends appropriate HTTP responses.
 *
 * @param error - The error object to handle.
 * @param res - The HTTP response object to send the response.
 */
const handleError = (error, res) => {
    if (error instanceof ClientError_1.ClientError) {
        // Handle client errors with a 400 Bad Request status code
        res.status(400).send({ errorMessage: error.message });
    }
    else {
        // Log other errors and send a generic 500 Internal Server Error status code
        log.error(error);
        res.sendStatus(500);
    }
};

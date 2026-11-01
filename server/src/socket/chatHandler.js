"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.handleChatMessage = handleChatMessage;
exports.handleEditMessage = handleEditMessage;
exports.handleReactMessage = handleReactMessage;
exports.handleDeleteMessage = handleDeleteMessage;
exports.handleDeleteChat = handleDeleteChat;
exports.handleUpdateNotice = handleUpdateNotice;
exports.handleUpdateFsNotice = handleUpdateFsNotice;
const config_1 = require("../config/repositoryFactory.js");
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const SocketEvents_1 = require("./socketEvents.js");
const User_1 = require("../models/User.js");
const htmlSanitizer_1 = require("../services/htmlSanitizer.js");
const log = (0, logger_1.default)(__filename);
/** every handler must acknowledge errors, otherwise the sender waits forever */
function safeCallback(callback, payload) {
    if (typeof callback === "function")
        callback(payload);
}
// Define the handler function for the "chatMessage" event
async function handleChatMessage(message, callback, socket) {
    log.debug(`Received chat message: ${JSON.stringify(message)}`);
    try {
        if (!message?.text?.trim()) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        if (message.text.length > htmlSanitizer_1.MAX_MESSAGE_CHARS) {
            safeCallback(callback, ClientError_1.ClientError.tooLargeError());
            return;
        }
        // get the repository
        const repository = (0, config_1.getMessageRepository)();
        message.username = socket.request.session.userInfo.username;
        message.role = socket.request.session.userInfo.isAdmin
            ? User_1.RoleEnum.ADMIN
            : User_1.RoleEnum.NON_ADMIN;
        // HTML in messages is supported — sanitize against a permissive allowlist server-side
        message.text = (0, htmlSanitizer_1.sanitizeMessageHtml)(message.text);
        if (!message.text.trim()) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        // Process the message or perform any necessary actions
        message.time = new Date().toISOString();
        // save
        const result = await repository.add(message);
        // Call the callback function to acknowledge the event
        safeCallback(callback, result);
        // Broadcast the chat message to all connected clients except the sender
        socket.broadcast.emit(SocketEvents_1.socketEvents.chatMessage, message);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
// Define the handler function for the "editMessage" event
async function handleEditMessage(updateMessage, socket, callback) {
    log.debug(`Received edit message: ${JSON.stringify(updateMessage)}`);
    try {
        if (!updateMessage?.id || !updateMessage?.text?.trim()) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        if (updateMessage.text.length > htmlSanitizer_1.MAX_MESSAGE_CHARS) {
            safeCallback(callback, ClientError_1.ClientError.tooLargeError());
            return;
        }
        // Get the repository
        const repository = (0, config_1.getMessageRepository)();
        // Get the message by id
        const message = await repository.find(updateMessage.id);
        if (!message) {
            safeCallback(callback, ClientError_1.ClientError.notExistsError());
            return;
        }
        const loggedInUser = socket.request.session.userInfo;
        if (message.username != loggedInUser.username) {
            safeCallback(callback, ClientError_1.ClientError.accessDeniedError());
            return;
        }
        message.text = (0, htmlSanitizer_1.sanitizeMessageHtml)(updateMessage.text);
        if (!message.text.trim()) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        message.edited_at = new Date().toISOString();
        // Update the message or perform any necessary actions
        const updatedMessage = await repository.update(message);
        // Call the callback function to acknowledge the event
        safeCallback(callback, updatedMessage);
        // Broadcast the edited message to all connected clients except the sender
        socket.broadcast.emit(SocketEvents_1.socketEvents.editedMessage, updatedMessage);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
// Define the handler function for the "reactMessage" event
async function handleReactMessage(reactedMessage, socket, callback) {
    log.debug(`Received reaction to message: ${JSON.stringify(reactedMessage)}`);
    try {
        if (!reactedMessage?.id)
            throw ClientError_1.ClientError.invalidError();
        // Get the repository
        const repository = (0, config_1.getMessageRepository)();
        // Get the message by id
        const message = await repository.find(reactedMessage.id);
        if (!message)
            throw ClientError_1.ClientError.invalidError();
        const curUserName = socket.request.session.userInfo.username;
        if (!message.reactions || typeof message.reactions !== "object")
            message.reactions = {};
        for (const emoji of Object.keys(reactedMessage.reactions || {})) {
            const incoming = reactedMessage.reactions[emoji];
            // tolerate malformed payloads
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
        // Update the message or perform any necessary actions
        await repository.update(message);
        // Call the callback function to acknowledge the event
        safeCallback(callback, reactedMessage);
        // Broadcast the edited message to all connected clients except the sender
        socket.broadcast.emit(SocketEvents_1.socketEvents.reactedMessage, reactedMessage);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
// Define the handler function for the "deleteChat" event
async function handleDeleteChat(socket, callback) {
    log.debug(`Received delete chat request.`);
    try {
        if (!socket.request.session.userInfo.isAdmin) {
            safeCallback(callback, ClientError_1.ClientError.accessDeniedError());
            return;
        }
        // Get the repository
        const repository = (0, config_1.getMessageRepository)();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        await repository.removeAll();
        // Call the callback function to acknowledge the event
        safeCallback(callback, "ok");
        // Broadcast the edited message to all connected clients except the sender
        socket.broadcast.emit(SocketEvents_1.socketEvents.chatDeleted);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
async function handleDeleteMessage(id, socket, callback) {
    try {
        if (!id) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        const loggedInUser = socket.request.session.userInfo;
        // get the repository
        const repository = (0, config_1.getMessageRepository)();
        const message = await repository.find(id);
        if (!message) {
            safeCallback(callback, { status: false });
            return;
        }
        if (message.username != loggedInUser.username && !loggedInUser.isAdmin) {
            safeCallback(callback, ClientError_1.ClientError.accessDeniedError());
            return;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const result = await repository.remove(id);
        if (result) {
            log.debug(`Deleted message with id: ${id}`);
            // Broadcast the deleted message to all connected clients except the sender
            socket.broadcast.emit(SocketEvents_1.socketEvents.deletedMessage, id);
            safeCallback(callback, { status: true });
        }
        else {
            log.debug(`Failed to delete msg ${id}, as the id doesn't exist`);
            safeCallback(callback, { status: false });
        }
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, { status: false, error: ClientError_1.ClientError.internalError() });
    }
}
async function handleUpdateNotice(socket, callback) {
    try {
        // only admins may trigger the notice refresh broadcast
        if (!socket.request.session.userInfo?.isAdmin) {
            safeCallback(callback, JSON.stringify({ success: false, error: "client_error.access_denied" }));
            return;
        }
        socket.broadcast.emit(SocketEvents_1.socketEvents.updateNotice);
        safeCallback(callback, JSON.stringify({ success: true }));
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, JSON.stringify({ success: false }));
    }
}
 async function handleUpdateFsNotice(socket, callback) {
     try {
         // only admins may trigger the fullscreen-notice refresh broadcast
         if (!socket.request.session.userInfo?.isAdmin) {
             safeCallback(callback, JSON.stringify({ success: false, error: "client_error.access_denied" }));
             return;
         }
         socket.broadcast.emit(SocketEvents_1.socketEvents.updateFsNotice);
         safeCallback(callback, JSON.stringify({ success: true }));
     }
     catch (err) {
         log.error(err);
         safeCallback(callback, JSON.stringify({ success: false }));
     }
 }
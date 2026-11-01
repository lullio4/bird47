"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.broadcastUsersList = broadcastUsersList;
exports.handleChangeStatus = handleChangeStatus;
exports.handleTriggerTyping = handleTriggerTyping;
const logger_1 = __importDefault(require("../logger.js"));
const UserDto_1 = require("../dto/UserDto.js");
const ClientError_1 = require("../models/ClientError.js");
const UserCrudService_1 = require("../services/userCrudService.js");
const config_1 = require("../config/repositoryFactory.js");
const SocketEvents_1 = require("./socketEvents.js");
const permissions_1 = require("../services/permissions.js");
const log = (0, logger_1.default)(__filename);
// TODO: needs clarification, why do we need cachedUsers?
const cachedUsers = [];
// Function to broadcast the active users list of connected users
async function broadcastUsersList(io) {
    try {
        let dbUsers = await (0, UserCrudService_1.getUsers)();
        // remove inactive users
        dbUsers = dbUsers.filter((user) => user.active);
        const activeUsers = getActiveUsers(io);
        let updatedUsers = dbUsers.map((user) => updateUserStatus(user, activeUsers));
        // remove all offline user list
        updatedUsers = updatedUsers.filter((user) => user.status === UserDto_1.userStatuses.online);
        // the admin may hide the online list from regular users, or open it to a
        // hand-picked list ("selected"); admins always see the full list.
        // if the setting store hiccups, fail open so chat keeps working.
        let setting = null;
        try {
            const settings = await (0, config_1.getSettingRepository)().get();
            setting = settings[0] || null;
        }
        catch (settingErr) {
            log.error(settingErr);
        }
        const failOpen = setting === null;
        for (const socket of io.sockets.sockets.values()) {
            const session = socket.request?.session?.userInfo;
            const maySeeAll = failOpen || (0, permissions_1.canSeeOnlineUsers)(setting, session);
            const payload = maySeeAll
                ? updatedUsers
                : updatedUsers.filter((u) => u.username === session?.username);
            socket.emit(SocketEvents_1.socketEvents.usersWithStatus, payload);
        }
    }
    catch (err) {
        log.error(err);
    }
}
function getActiveUsers(io) {
    return Array.from(io.sockets.sockets.values()).map(({ id, handshake, request }) => {
        const { time } = handshake;
        const username = request.session.userInfo.username;
        return { socketId: id, username, connectedAt: time };
    });
}
function updateUserStatus(user, activeUsers) {
    const activeUser = activeUsers.find((activeUser) => activeUser.username === user.username);
    const time = activeUser
        ? new Date(activeUser.connectedAt).toISOString()
        : user.lastLoginDate || user.createdDate;
    const socketId = activeUser ? activeUser.socketId : undefined;
    const cachedUserIndex = cachedUsers.findIndex((cachedUser) => cachedUser.username === user.username);
    const status = activeUser ? UserDto_1.userStatuses.online : UserDto_1.userStatuses.offline;
    const updatedUser = {
        username: user.username,
        status,
        time,
        socketId,
        active: user.active,
        typing: false,
    };
    if (cachedUserIndex === -1) {
        cachedUsers.push(updatedUser);
    }
    else {
        cachedUsers[cachedUserIndex] = updatedUser;
    }
    return updatedUser;
}
// Define the handler function for the "changeStatus" event
async function handleChangeStatus(user, socket, callback) {
    log.debug(`Received update status to user: ${JSON.stringify(user)}`);
    try {
        // identity always comes from the session — clients cannot spoof other users
        const username = socket.request.session.userInfo?.username;
        const cuIndex = cachedUsers.findIndex((u) => u.username == username);
        const cUser = cachedUsers[cuIndex];
        if (cUser) {
            cachedUsers[cuIndex].status = user?.status;
            cachedUsers[cuIndex].username = username;
            // Call the callback function to acknowledge the event
            if (typeof callback === "function") {
                callback(cUser);
            }
            // Broadcast the edited message to all connected clients except the sender
            socket.broadcast.emit(SocketEvents_1.socketEvents.changedStatus, cUser);
        }
        else {
            // user doesn't exist, but still Call the callback function to acknowledge the event
            // TODO: poor design, need to send error response to client
            if (typeof callback === "function") {
                callback({ ...user, username });
            }
        }
    }
    catch (err) {
        log.error(err);
        if (typeof callback === "function")
            callback(ClientError_1.ClientError.internalError());
    }
}
// per-username throttle for typing broadcasts — protects mobile clients from
// duplicated/coalesced upstream traffic without changing the client contract
const lastTypingBroadcast = new Map();
const TYPING_MIN_INTERVAL_MS = 1200;
// Define the handler function for the "triggerTyping" event
async function handleTriggerTyping(user, socket, callback) {
    try {
        const username = socket.request.session.userInfo?.username;
        const typing = user?.typing !== false;
        const now = Date.now();
        const last = lastTypingBroadcast.get(username) || 0;
        if (typing && now - last < TYPING_MIN_INTERVAL_MS) {
            // coalesce duplicate typing events silently
            if (typeof callback === "function")
                callback(JSON.stringify({ ...user, username, typing: true }));
            return;
        }
        lastTypingBroadcast.set(username, now);
        const payload = { ...(user || {}), username, typing };
        log.debug(`Broadcasting typing status: ${JSON.stringify(payload)}`);
        if (typeof callback === "function") {
            callback(JSON.stringify(payload));
        }
        socket.broadcast.emit(SocketEvents_1.socketEvents.typingMessage, payload);
    }
    catch (err) {
        log.error(err);
        if (typeof callback === "function")
            callback(JSON.stringify({ error: true }));
    }
}

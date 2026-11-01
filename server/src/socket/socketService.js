"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const chatHandler_1 = require("./chatHandler.js");
const userHandler_1 = require("./userHandler.js");
const Message_1 = require("../models/Message.js");
const SocketEvents_1 = require("./socketEvents.js");
function socketService(io) {
    // Define the event handler for socket connection
    const onConnection = (socket) => {
        const sessionId = socket.request.session.id;
        // we only need this to disconnect the socket, when user logs out
        socket.join(sessionId);
        socket.on(SocketEvents_1.socketEvents.disconnect, () => {
            (0, userHandler_1.broadcastUsersList)(io);
        });
        // new user or reconnect user will get active users list
        (0, userHandler_1.broadcastUsersList)(io);
        // Handle the "editMessage" event
        socket.on(SocketEvents_1.socketEvents.editMessage, (message, callback) => {
            (0, chatHandler_1.handleEditMessage)(message, socket, callback);
        });
        // Handle the "reactMessage" event
        socket.on(SocketEvents_1.socketEvents.reactMessage, (message, callback) => {
            (0, chatHandler_1.handleReactMessage)(message, socket, callback);
        });
        // Handle the "DeleteMessage" event
        socket.on(SocketEvents_1.socketEvents.deleteMessage, (id, callback) => {
            (0, chatHandler_1.handleDeleteMessage)(id, socket, callback);
        });
        // Handle the "deleteChat" event
        socket.on(SocketEvents_1.socketEvents.deleteChat, (callback) => {
            (0, chatHandler_1.handleDeleteChat)(socket, callback);
        });
        /* Handle the "chatMessage" event
         callback is needed for acknowledgements
         for more info visit the link
         https://socket.io/docs/v4/emitting-events/#acknowledgements
         */
        socket.on(SocketEvents_1.socketEvents.chatMessage, (message, callback) => {
            (0, chatHandler_1.handleChatMessage)(new Message_1.Message(message), callback, socket);
        });
        // Event listener for updating notice message
        socket.on(SocketEvents_1.socketEvents.updateNotice, (callback) => {
            (0, chatHandler_1.handleUpdateNotice)(socket, callback);
        });
        // Event listener for updating the fullscreen login notice
        socket.on(SocketEvents_1.socketEvents.updateFsNotice, (callback) => {
            (0, chatHandler_1.handleUpdateFsNotice)(socket, callback);
        });
        // Event listener for updating user status
        socket.on(SocketEvents_1.socketEvents.changeStatus, (user, callback) => {
            (0, userHandler_1.handleChangeStatus)(user, socket, callback);
        });
        // Event listener for updating notice message
        socket.on(SocketEvents_1.socketEvents.triggerTyping, (user, callback) => {
            (0, userHandler_1.handleTriggerTyping)(user, socket, callback);
        });
    };
    // Attach the connection event handler to the Socket.IO server
    io.on("connection", onConnection);
}
exports["default"] = socketService;

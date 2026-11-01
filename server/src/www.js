"use strict";

/**
 * Module dependencies.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.destroySocketSession = void 0;
const app_1 = require("./app.js");
const debug_1 = __importDefault(require("debug"));
(0, debug_1.default)("backend:server");
const http_1 = require("http");
const SocketService_1 = __importDefault(require("./socket/socketService.js"));
const socket_io_1 = require("socket.io");
const logger_1 = __importDefault(require("./logger.js"));
const sessionGuard_1 = require("./services/sessionGuard.js");
const log = (0, logger_1.default)(__filename);
/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || "3000");
app_1.app.set("port", port);
/**
 * Create HTTP server.
 */
const nodeServer = (0, http_1.createServer)(app_1.app);
// serveClient on: the addon layer loads the official client from
// /socket.io/socket.io.js for its own custom-reaction connection
const io = new socket_io_1.Server(nodeServer, { serveClient: true });
// convert a connect middleware to a Socket.IO middleware
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
const wrap = (middleware) => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(app_1.sessionMiddleware));
// only allow authenticated users
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.authenticated) {
        // the seeded default admin must finish the forced password change first
        if (session.userInfo?.mustChangePassword) {
            return next(new Error("password_change_required"));
        }
        // admin-kicked users may not open new sockets with old sessions
        if (sessionGuard_1.isRevoked(session.userInfo?.username, session.userInfo?.loginAt)) {
            session.destroy(() => { });
            return next(new Error("unauthorized"));
        }
        next();
    }
    else {
        next(new Error("unauthorized"));
    }
});
/**
 * Initialize socket service.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
(0, SocketService_1.default)(io);
/**
 * Handling logout
 * https://socket.io/how-to/use-with-express-session
 * @param sessionId
 */
const destroySocketSession = (sessionId) => {
    io.in(sessionId).disconnectSockets();
};
exports.destroySocketSession = destroySocketSession;
/**
 * Admin kick: drop every live socket of `username` (all their devices and
 * tabs). Their express sessions are invalidated separately by the revocation
 * map (services/sessionGuard.js) checked in the API and socket middlewares.
 * @param {string} username
 */
const kickUserSockets = (username) => {
    let dropped = 0;
    for (const socket of io.sockets.sockets.values()) {
        const sessionUsername = socket.request?.session?.userInfo?.username;
        if (sessionUsername && sessionUsername.toLowerCase() === String(username || "").toLowerCase()) {
            // destroy the underlying express session so an instant reconnect fails
            try {
                socket.request.session.destroy(() => { });
            }
            catch (err) {
                log.error(err);
            }
            socket.disconnect(true);
            dropped++;
        }
    }
    log.debug(`kickUserSockets(${username}): dropped ${dropped} socket(s)`);
    return dropped;
};
exports.kickUserSockets = kickUserSockets;
/**
 * Listen on provided port, on all network interfaces.
 */
nodeServer.listen(port);
nodeServer.on("error", onError);
nodeServer.on("listening", onListening);
log.info("Server is listening on port  " + port);
/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    const port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    if (port >= 0) {
        // port number
        return port;
    }
    return false;
}
/**
 * Event listener for HTTP server "error" event.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
function onError(error) {
    if (error.syscall !== "listen") {
        throw error;
    }
    const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case "EACCES":
            log.error(bind + " requires elevated privileges");
            process.exit(1);
            break;
        case "EADDRINUSE":
            log.error(bind + " is already in use");
            process.exit(1);
            break;
        default:
            throw error;
    }
}
/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
    const addr = nodeServer.address();
    const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr?.port;
    (0, debug_1.default)("Listening on " + bind);
    console.log("Listening on " + bind);
}

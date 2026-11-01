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
exports.sessionMiddleware = exports.app = void 0;
const dotenv = __importStar(require("dotenv")); // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const express_session_1 = __importDefault(require("express-session"));
const require_1 = __importDefault(require("crypto"));
const auth_1 = __importDefault(require("./routes/authRouter.js"));
const router_1 = __importDefault(require("./routes/apiRouter.js"));
const memorystore_1 = __importDefault(require("memorystore"));
const paths_1 = require("./paths.js");
const config_1 = require("./config/repositoryFactory.js");
const permissions_1 = require("./services/permissions.js");
const attendanceService_1 = require("./services/attendanceService.js");
const logger_1 = __importDefault(require("./logger.js"));
const log = (0, logger_1.default)(__filename);
// initialize storage repository and insert dummy admin user( with super admin role)
require("./bootstrap/initData.js");
const app = (0, express_1.default)();
exports.app = app;
// Render (and other PaaS) terminate TLS at a proxy — trust it so cookies/secure work
app.set("trust proxy", 1);
// liveness probe for Render health checks (kept before session middleware so it stays cheap)
app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok", version: APP_VERSION, uptime: process.uptime() });
});
// app version — single source of truth is package.json
const APP_VERSION = (() => {
    try {
        return require(path_1.default.join(paths_1.PROJECT_ROOT, "package.json")).version;
    }
    catch {
        return process.env.APP_VERSION || "3.0.0";
    }
})();
// session signing key: from the environment in production; a fresh random value
// per boot when it is absent (local dev) so no shared literal ever signs cookies
const sessionSecret = process.env.SESSION_SECRET || require_1.default.randomBytes(32).toString("hex");
let sessionStore;
if (process.env.NODE_ENV === "development")
    // use basic memoryStore in development mode for less memory usage
    sessionStore = new express_session_1.default.MemoryStore();
else {
    const MemoryStore = (0, memorystore_1.default)(express_session_1.default);
    sessionStore = new MemoryStore({
        checkPeriod: 3600000, // prune expired entries every 1h
    });
}
const sessionMiddleware = (0, express_session_1.default)({
    // secret from environment; the hardcoded value is only a fallback for local dev
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 10 * (1000 * 60 * 60), // 10 hours
        sameSite: "lax",
        // "auto" marks the cookie Secure when the request arrived over https (behind the trusted proxy)
        secure: "auto",
    },
    store: sessionStore,
});
exports.sessionMiddleware = sessionMiddleware;
// Session Setup
app.use(sessionMiddleware);
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.urlencoded({ extended: false }));
// serve react static contents (absolute path so the CWD doesn't matter)
// serve react static contents (absolute path so the CWD doesn't matter);
// etags stay on so the ?v= cache-busting query in index.html always picks up
// freshly changed addon files
app.use(express_1.default.static(paths_1.PROJECT_ROOT && path_1.default.join(paths_1.PROJECT_ROOT, "public"), {
    etag: true,
    lastModified: true,
    cacheControl: false,
}));
/**
 * Attendance counter — a standalone raw-html page.
 *
 * GET /attendance renders the admin-authored html document and NOTHING else:
 * no SPA shell, no navbar, no injected script. The session still decides who
 * may open it (admins + the hand-picked "selected" list).
 */
const attendanceCounter = async (req, res) => {
    const user = req.session?.userInfo;
    if (!user?.username) {
        const page = (0, attendanceService_1.attendanceEmptyPage)("/login");
        return res.status(page.status).set(page.headers).send(page.body);
    }
    let setting = null;
    try {
        const settings = await (0, config_1.getSettingRepository)().get();
        setting = settings[0] || null;
    }
    catch (error) {
        log.error(error);
        return res.status(503).set("Content-Type", "text/plain; charset=utf-8").send("storage unavailable");
    }
    if (!setting || !(0, permissions_1.canViewAttendance)(setting, user)) {
        const page = (0, attendanceService_1.attendanceDeniedPage)();
        return res.status(page.status).set(page.headers).send(page.body);
    }
    const page = (0, attendanceService_1.renderAttendancePage)(setting.attendanceHtml);
    res.status(page.status).set(page.headers).send(page.body);
};
app.get(["/attendance", "/attendance/"], attendanceCounter);
// ***************** List of routes starts ***********************
// Mount auth router at /auth
app.use("/auth", auth_1.default);
// Mount API router at /api
app.use("/api", router_1.default);
// unknown API paths must not fall through to the SPA
app.use(["/api", "/auth"], (req, res) => {
    res.status(404).json({ message: "Not found" });
});
app.get("*", (req, res) => {
    res.sendFile(path_1.default.join(paths_1.PROJECT_ROOT, "public", "index.html"));
});

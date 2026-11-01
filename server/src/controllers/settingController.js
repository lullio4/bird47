"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.saveAttendanceHtml = exports.getAttendanceSettings = exports.restoreFrequentSymbols = exports.saveFrequentSymbols = exports.getFrequentSymbols = exports.saveAdjustedHijri = exports.getHijriAdjustment = exports.deleteChat = exports.canWeChat = exports.disableChat = exports.enableChat = exports.downloadFormatted = exports.downloadChat = exports.updateNotice = exports.getNotice = void 0;
exports.getHijri = getHijri;
/** feature visibility for the addon layer — every logged-in user may read it */
const getVisibility = async (req, res) => {
    try {
        const setting = await getSetting();
        // resolved booleans, not usernames: the list of selected users stays admin-only
        res.status(200).json((0, permissions_1.permissionSummary)(setting, req.session?.userInfo));
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getVisibility = getVisibility;
/**
 * admin toggle for the addon features: copy button, online-users list and the
 * attendance counter; each "selected" mode also stores its own username list
 */
const saveAdminSettings = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        const { copyAllMode, copyAllSelected, showOnlineUsers, onlineUsersSelected, attendanceViewMode, attendanceSelected, } = req.body || {};
        if (copyAllMode !== undefined) {
            if (!permissions_1.MODES.includes(copyAllMode))
                return res.sendStatus(400);
            setting.copyAllMode = copyAllMode;
        }
        if (copyAllSelected !== undefined)
            setting.copyAllSelected = (0, Setting_1.normalizeUsernames)(copyAllSelected);
        if (showOnlineUsers !== undefined) {
            // legacy clients send a boolean; new ones send the mode string
            const mode = typeof showOnlineUsers === "boolean"
                ? (showOnlineUsers ? "all" : "admin")
                : showOnlineUsers;
            if (!permissions_1.MODES.includes(mode))
                return res.sendStatus(400);
            setting.showOnlineUsers = mode;
        }
        if (onlineUsersSelected !== undefined)
            setting.onlineUsersSelected = (0, Setting_1.normalizeUsernames)(onlineUsersSelected);
        if (attendanceViewMode !== undefined) {
            // the attendance page is never public — only admin/selected are allowed
            if (attendanceViewMode !== "admin" && attendanceViewMode !== "selected")
                return res.sendStatus(400);
            setting.attendanceViewMode = attendanceViewMode;
        }
        if (attendanceSelected !== undefined)
            setting.attendanceSelected = (0, Setting_1.normalizeUsernames)(attendanceSelected);
        await repository.update(setting);
        res.status(200).json((0, permissions_1.permissionSummary)(setting, req.session?.userInfo));
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.saveAdminSettings = saveAdminSettings;
/** admin-only read of the full permission lists (the panel needs the names) */
const getAdminSettings = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const setting = await getSetting();
        res.status(200).json((0, permissions_1.adminSettingsPayload)(setting));
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getAdminSettings = getAdminSettings;
/** admin-only read of the attendance counter settings (html + who may view it) */
const getAttendanceSettings = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const setting = await getSetting();
        res.status(200).json((0, attendanceService_1.attendanceSettingsPayload)(setting));
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getAttendanceSettings = getAttendanceSettings;
/** admin-only write of the raw html that GET /attendance renders */
const saveAttendanceHtml = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const html = (0, attendanceService_1.validateAttendanceHtml)(req.body?.attendanceHtml);
        if (html === null)
            return res.status(400).json({ errorMessage: "client_error.too_large_error" });
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.attendanceHtml = html;
        await repository.update(setting);
        log.info(`attendance html saved (${html.length} chars)`);
        res.status(200).json((0, attendanceService_1.attendanceSettingsPayload)(setting));
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.saveAttendanceHtml = saveAttendanceHtml;
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const ChatService_1 = require("../services/chatService.js");
const config_1 = require("../config/repositoryFactory.js");
const Setting_1 = require("../models/Setting.js");
const SettingService_1 = require("../services/settingService.js");
const htmlSanitizer_1 = require("../services/htmlSanitizer.js");
const permissions_1 = require("../services/permissions.js");
const attendanceService_1 = require("../services/attendanceService.js");
const log = (0, logger_1.default)(__filename);
/** the settings store may still be initializing at boot — fail softly instead of crashing */
async function getSetting() {
    const settings = await (0, config_1.getSettingRepository)().get();
    const setting = settings[0];
    if (!setting)
        throw ClientError_1.ClientError.connectionFailedError();
    return setting;
}
const getNotice = async (req, res) => {
    try {
        const setting = await getSetting();
        res.status(200).json({ notice: setting.notice });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getNotice = getNotice;
const getFrequentSymbols = async (req, res) => {
    try {
        const setting = await getSetting();
        res.status(200).json({ frequentSymbols: setting.frequentSymbols });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getFrequentSymbols = getFrequentSymbols;
const saveFrequentSymbols = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.frequentSymbols = typeof req.body.frequentSymbols === "string" ? req.body.frequentSymbols.slice(0, 20000) : "";
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.saveFrequentSymbols = saveFrequentSymbols;
const restoreFrequentSymbols = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.frequentSymbols = Setting_1.initialFrequentSymbols;
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.restoreFrequentSymbols = restoreFrequentSymbols;
const updateNotice = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("updating notice");
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        // HTML+CSS notice is supported — sanitized server-side, length-capped
        setting.notice = (0, htmlSanitizer_1.sanitizeNoticeHtml)(typeof req.body?.notice === "string" ? req.body.notice.slice(0, htmlSanitizer_1.MAX_NOTICE_CHARS) : "");
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.updateNotice = updateNotice;
/** logged-in read of the fullscreen login notice (raw html/css/js, admin-authored) */
const getFsNotice = async (req, res) => {
    try {
        const setting = await getSetting();
        // raw stored docs (disk storage) predate these fields — coerce instead of
        // letting JSON.stringify drop them as undefined
        res.status(200).json({ notice: setting.fsNotice || "", updatedAt: setting.fsNoticeUpdatedAt || "" });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getFsNotice = getFsNotice;
/** admin-only write of the fullscreen notice — stored raw (like the attendance
 * html): only admins can write it and only logged-in users can read it; the
 * addon renders it in a dedicated fullscreen div after every login */
const updateFsNotice = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("updating fullscreen notice");
    try {
        const raw = typeof req.body?.notice === "string" ? req.body.notice : "";
        if (raw.length > Setting_1.SETTING_LIMITS.fsNotice)
            return res.status(400).json({ errorMessage: "client_error.too_large_error" });
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.fsNotice = raw;
        setting.fsNoticeUpdatedAt = new Date().toISOString();
        await repository.update(setting);
        log.info(`fullscreen notice saved (${raw.length} chars)`);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.updateFsNotice = updateFsNotice;
const enableChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("enabling chat");
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.chatState = true;
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.enableChat = enableChat;
const disableChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("disabling chat");
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.chatState = false;
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.disableChat = disableChat;
const canWeChat = async (req, res) => {
    try {
        const setting = await getSetting();
        const peopleCanChat = setting.chatState;
        res.status(200).json({ peopleCanChat });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.canWeChat = canWeChat;
const deleteChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("Deleting all messages...");
    try {
        await (0, ChatService_1.deleteAllChat)(res);
        log.debug("all messages deleted successfully.");
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.deleteChat = deleteChat;
const downloadChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("Downloading all messages...");
    try {
        await (0, ChatService_1.downloadJson)(res);
        log.debug("all messages downloaded successfully.");
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.downloadChat = downloadChat;
const downloadFormatted = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("Downloading all messages...");
    try {
        const messages = await (0, ChatService_1.downloadAll)();
        log.debug("all messages downloaded successfully.");
        res.status(200).json(messages);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.downloadFormatted = downloadFormatted;
async function getHijri(req, res) {
    try {
        const hijri = await (0, SettingService_1.getHijriDate)();
        res.status(200).json({ hijri });
    }
    catch (error) {
        handleError(error, res);
    }
}
const getHijriAdjustment = async (req, res) => {
    try {
        const setting = await getSetting();
        res.status(200).json({ adjustment: setting.hijri?.adjustment ?? 0 });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getHijriAdjustment = getHijriAdjustment;
const saveAdjustedHijri = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const settingRepo = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        const adjusted = Number(req.body?.adjustedNumber);
        if (Number.isNaN(adjusted) || adjusted < -30 || adjusted > 30)
            return res.sendStatus(400);
        setting.hijri.adjustment = adjusted;
        // recompute immediately so the header shows the adjusted date right away
        setting.hijri.lastUpdate = "";
        await settingRepo.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.saveAdjustedHijri = saveAdjustedHijri;
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

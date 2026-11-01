"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));






/**
 * Feature-permission resolution shared by the REST controllers, the socket
 * handlers and the addon-facing visibility endpoint.
 *
 * Modes:
 *   "all"      → everybody
 *   "admin"    → admins only
 *   "selected" → admins plus the usernames listed for that feature
 *
 * Admins can always use every feature (an admin can never lock themselves out
 * of their own panel). Every read tolerates a missing/legacy document, so an
 * old store or a half-written Setting never disables a feature by accident.
 */

const MODES = ["all", "admin", "selected"];

const isset = (value) => value !== undefined && value !== null && value !== "";

const normalizeMode = (value, fallback) => (MODES.includes(value) ? value : fallback);

const memberList = (value) => (Array.isArray(value) ? value : []);

const isListed = (list, username) => {
    if (!username) return false;
    const needle = String(username).toLowerCase();
    return memberList(list).some(
        (entry) => typeof entry === "string" && entry.trim().toLowerCase() === needle
    );
};

/**
 * @param {'all'|'admin'|'selected'} mode
 * @param {string[]} selected
 * @param {{username?: string, isAdmin?: boolean}|null|undefined} user
 */
const canUseFeature = (mode, selected, user) => {
    if (!user || !user.username) return false;
    if (user.isAdmin) return true;
    if (mode === "all") return true;
    if (mode === "selected") return isListed(selected, user.username);
    return false; // "admin"
};

/** who may export / copy the whole conversation */
const canUseCopyAll = (setting, user) =>
    canUseFeature(
        normalizeMode(setting?.copyAllMode, "all"),
        setting?.copyAllSelected,
        user
    );

/** who may see the online-users list (and the users tab) */
const canSeeOnlineUsers = (setting, user) =>
    canUseFeature(
        normalizeMode(setting?.showOnlineUsers, "all"),
        setting?.onlineUsersSelected,
        user
    );

/** who may open the attendance counter page */
const canViewAttendance = (setting, user) =>
    canUseFeature(
        normalizeMode(setting?.attendanceViewMode, "admin"),
        setting?.attendanceSelected,
        user
    );

/**
 * Response payload of GET /api/chat/visibility — every logged-in user reads it,
 * so it stays free of usernames: only the resolved booleans plus the mode.
 */
const permissionSummary = (setting, user) => ({
    copyAllMode: normalizeMode(setting?.copyAllMode, "all"),
    copyAllSelectedCount: memberList(setting?.copyAllSelected).length,
    canCopyAll: canUseCopyAll(setting, user),
    showOnlineUsers: normalizeMode(setting?.showOnlineUsers, "all"),
    onlineUsersSelectedCount: memberList(setting?.onlineUsersSelected).length,
    canSeeOnlineUsers: canSeeOnlineUsers(setting, user),
    attendanceMode: normalizeMode(setting?.attendanceViewMode, "admin"),
    attendanceSelectedCount: memberList(setting?.attendanceSelected).length,
    canViewAttendance: canViewAttendance(setting, user),
    hasAttendanceHtml: typeof setting?.attendanceHtml === "string" && setting.attendanceHtml.length > 0,
    version: isset(setting?.version) ? setting.version : undefined,
});






/** GET /api/chat/admin-settings — full lists for the admin panel (admin-only) */
const adminSettingsPayload = (setting) => ({
    copyAllMode: normalizeMode(setting?.copyAllMode, "all"),
    copyAllSelected: memberList(setting?.copyAllSelected),
    showOnlineUsers: normalizeMode(setting?.showOnlineUsers, "all"),
    onlineUsersSelected: memberList(setting?.onlineUsersSelected),
    attendanceMode: normalizeMode(setting?.attendanceViewMode, "admin"),
    attendanceSelected: memberList(setting?.attendanceSelected),
});

// ---- exports (assigned after declarations) ----
exports.MODES = MODES;
exports.adminSettingsPayload = adminSettingsPayload;
exports.canSeeOnlineUsers = canSeeOnlineUsers;
exports.canUseCopyAll = canUseCopyAll;
exports.canUseFeature = canUseFeature;
exports.canViewAttendance = canViewAttendance;
exports.isListed = isListed;
exports.normalizeMode = normalizeMode;
exports.permissionSummary = permissionSummary;

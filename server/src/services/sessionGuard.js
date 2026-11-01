"use strict";

/**
 * In-memory session revocation for admin "kick user".
 * Keeps a username → revocation timestamp map: any session whose login
 * happened before that timestamp is treated as revoked, so every device
 * of the kicked user is locked out at the next request, and the live
 * sockets are dropped immediately (see www.js kickUserSockets).
 * The map lives in memory on purpose — sessions are in-memory too, so a
 * restart invalidates everything at once and persistence would add nothing.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.revokeUser = revokeUser;
exports.isRevoked = isRevoked;
exports.getRevokedAt = getRevokedAt;

const revokedUsers = new Map();

/** revoke every session of `username` created before now; returns the timestamp */
function revokeUser(username) {
    const at = Date.now();
    revokedUsers.set(String(username || "").toLowerCase(), at);
    return at;
}

function getRevokedAt(username) {
    const at = revokedUsers.get(String(username || "").toLowerCase());
    return typeof at === "number" ? at : 0;
}

/** a session is revoked when its login time predates the revocation stamp */
function isRevoked(username, loginAt) {
    const at = getRevokedAt(username);
    if (!at)
        return false;
    const login = Number(loginAt) || 0;
    return login < at;
}

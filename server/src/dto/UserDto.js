"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.userStatuses = exports.SessionUser = exports.UserDto = void 0;
const BaseDto_1 = require("./BaseDto.js");
const bcrypt_1 = __importDefault(require("bcryptjs"));
class UserDto extends BaseDto_1.BaseDto {
    username;
    password;
    langPref;
    active;
    isAdmin;
    createdDate;
    lastLoginDate;
    isSuperAdmin;
    mustChangePassword = false;
    soundPref = true;
    constructor(json) {
        super(json);
        // Assign values with falsy checks
        this.username = json?.username || "";
        this.password = json?.password || "";
        this.langPref = json?.langPref || "en";
        this.active = json?.active || false;
        this.isAdmin = json?.isAdmin || false;
        this.isSuperAdmin = json.isSuperAdmin || false;
        this.mustChangePassword = json?.mustChangePassword ?? false;
        this.soundPref = json?.soundPref ?? json?.sound_pref ?? true;
        this.lastLoginDate = json?.lastLoginDate;
        this.createdDate = json?.createdDate;
    }
    /** client-safe projection — never exposes the password hash */
    toSafeJson() {
        return {
            id: this.id,
            username: this.username,
            langPref: this.langPref,
            active: this.active,
            isAdmin: this.isAdmin,
            isSuperAdmin: this.isSuperAdmin,
            mustChangePassword: this.mustChangePassword,
            soundPref: this.soundPref,
            createdDate: this.createdDate,
            lastLoginDate: this.lastLoginDate,
        };
    }
    isValid() {
        return !!this.username?.trim();
    }
    isValidCredentials() {
        // if username or password is empty or null, then invalid
        return !!this.username?.trim() && !!this.password?.trim();
    }
    getPasswordHash(saltRounds = 10) {
        // if password is empty or null, then return empty string else the hashed password
        return this.password?.trim()
            ? bcrypt_1.default.hashSync(this.password, saltRounds)
            : "";
    }
}
exports.UserDto = UserDto;
/**
 * Represents current loggedin User
 */
class SessionUser {
    id;
    username;
    langPref;
    active;
    isAdmin;
    soundPref;
    mustChangePassword;
    /** epoch ms of the login that created this session — lets the admin
        kick revoke only sessions created before the kick */
    loginAt;
    constructor(id, username, langPref, active, isAdmin, soundPref, mustChangePassword = false, loginAt = 0) {
        this.id = id;
        this.username = username;
        this.langPref = langPref;
        this.active = active;
        this.isAdmin = isAdmin;
        this.soundPref = soundPref;
        this.mustChangePassword = mustChangePassword;
        this.loginAt = loginAt;
    }
}
exports.SessionUser = SessionUser;
// TODO: rename below constant to UserStatus
const userStatuses = {
    online: "online",
    offline: "offline",
    away: "away",
};
exports.userStatuses = userStatuses;

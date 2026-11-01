"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RoleEnum = exports.User = void 0;
const BaseModel_1 = require("./BaseModel.js");
class User extends BaseModel_1.BaseModel {
    username;
    password;
    active;
    langPref;
    isAdmin;
    createdDate;
    lastLoginDate;
    /** special admin who was created when no user existed. this super admin cannot be removed */
    isSuperAdmin;
    /** set on the seeded default admin; forces a password change on first login */
    mustChangePassword = false;
    soundPref = true;
    constructor(json = {}) {
        super(json);
        this.username = json.username || "";
        this.password = json.password || "";
        this.active = json.active ?? false;
        this.langPref = json.langPref || "en";
        this.isAdmin = json.isAdmin || false;
        this.isSuperAdmin = json.isSuperAdmin || false;
        this.mustChangePassword = json.mustChangePassword ?? false;
        this.soundPref = json.soundPref ?? json.sound_pref ?? true;
        // Initialize createdDate from server (current date and time)
        this.createdDate = new Date();
        this.lastLoginDate = undefined;
    }
}
exports.User = User;
var RoleEnum;
(function (RoleEnum) {
    RoleEnum[RoleEnum["ADMIN"] = 100] = "ADMIN";
    RoleEnum[RoleEnum["NON_ADMIN"] = 200] = "NON_ADMIN";
})(RoleEnum || (exports.RoleEnum = RoleEnum = {}));

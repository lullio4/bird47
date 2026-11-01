"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Message = void 0;
const BaseModel_1 = require("./BaseModel.js");
const User_1 = require("./User.js");
class ReplyTo {
    id;
    username;
    text;
    constructor(json) {
        this.id = json.id;
        // guard: client-controlled payload may lack text
        this.text = typeof json.text === "string" ? json.text.substr(0, 50) : ""; // don't store more than 50 character
        this.username = json.username;
    }
}
class Message extends BaseModel_1.BaseModel {
    text;
    username;
    time;
    replyTo;
    edited_at;
    role = User_1.RoleEnum.NON_ADMIN;
    reactions;
    constructor(json = {}) {
        super(json);
        this.text = json.text || "";
        this.username = json.username || "";
        this.time = json.time || "";
        this.replyTo = json.replyTo ? new ReplyTo(json.replyTo) : null;
        this.reactions = json.reactions || {};
    }
}
exports.Message = Message;

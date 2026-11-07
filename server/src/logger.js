"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports["default"] = default_1;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const chatroom_react_express = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level} ${info.filename}: ${info.message} ${info.stack ? info.stack : ""}`));
const logger = winston_1.default.createLogger({
    // Owner request (2026-11-05): ALL logging off except errors —
    // errors still reach chatroom_react_express-error.log and the console.
    // Set LOG_LEVEL=debug (env) to temporarily bring info/debug logs back.
    level: process.env.LOG_LEVEL || "error",
    format: chatroom_react_express,
    transports: [
        //
        // - Write all logs with importance level of `error` or higher to the error file
        //   (info/debug chatter is disabled; no combined info log file anymore)
        //
        new winston_1.default.transports.File({
            filename: "chatroom_react_express-error.log",
            level: "error",
        }),
        // - Console mirrors the same error-only level
        new winston_1.default.transports.Console({
            format: chatroom_react_express,
        }),
    ],
});
function default_1(filename) {
    return logger.child({ filename: path_1.default.basename(filename) });
}

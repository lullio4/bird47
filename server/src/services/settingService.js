"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getNewMessageId = getNewMessageId;
exports.getHijriDate = getHijriDate;
const config_1 = require("../config/repositoryFactory.js");
const logger_1 = __importDefault(require("../logger.js"));
const log = (0, logger_1.default)(__filename);
async function getNewMessageId() {
    const messageRepo = (0, config_1.getMessageRepository)();
    const messages = await messageRepo.get();
    const message = messages.at(-1);
    return message ? +message.id + 1 : 1;
}
/**
 * Hijri date is computed locally with Node's built-in ICU (Umm al-Qura calendar)
 * for the Asia/Dhaka timezone — no external API dependency, correct rollover.
 * The user-facing ±day adjustment (reconciling with local moon sighting) is
 * applied on the Gregorian instant BEFORE conversion, so month/year carry correctly.
 */
const HIJRI_TIMEZONE = process.env.HIJRI_TIMEZONE || "Asia/Dhaka";
let hijriFormatter = null;
function getHijriFormatter() {
    if (!hijriFormatter) {
        hijriFormatter = new Intl.DateTimeFormat(`en-u-ca-islamic-umalqura-nu-latn`, {
            timeZone: HIJRI_TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    }
    return hijriFormatter;
}
function toHijriYMD(date) {
    const parts = getHijriFormatter().formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const year = get("year").padStart(4, "0");
    const month = get("month").padStart(2, "0");
    const day = get("day").padStart(2, "0");
    return `${year}-${month}-${day}`;
}
const updateHijri = async () => {
    const now = new Date();
    const settingRepo = (0, config_1.getSettingRepository)();
    const settings = await settingRepo.get();
    const setting = settings[0];
    if (!setting)
        return "";
    const adjustment = Number(setting.hijri?.adjustment) || 0;
    const adjustedInstant = new Date(now.getTime() + adjustment * 24 * 60 * 60 * 1000);
    const hijri = toHijriYMD(adjustedInstant);
    setting.hijri = {
        date: hijri,
        lastUpdate: now.toISOString(),
        adjustment
    };
    await settingRepo.update(setting);
    log.debug(`updated hijri date successfully: ${hijri}`);
    return hijri;
};
async function getHijriDate() {
    const settingRepo = (0, config_1.getSettingRepository)();
    const settings = await settingRepo.get();
    const setting = settings[0];
    if (!setting?.hijri)
        return "";
    const oneHourInMilliseconds = 60 * 60 * 1000;
    const lastUpdate = new Date(setting.hijri.lastUpdate).getTime();
    const currentTime = new Date().getTime();
    if (!setting.hijri.date || Number.isNaN(lastUpdate) || currentTime - lastUpdate >= oneHourInMilliseconds) {
        return await updateHijri();
    }
    return setting.hijri.date;
}

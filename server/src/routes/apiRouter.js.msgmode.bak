"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const SettingController_1 = require("../controllers/settingController.js");
const UserController_1 = require("../controllers/userController.js");
const ChatController_1 = require("../controllers/chatController.js");
const sessionGuard_1 = require("../services/sessionGuard.js");
const router = express_1.default.Router();
/* router level middleware
 * all routes starting with /api must be loggedin
 */
router.use((req, res, next) => {
    if (req.session?.userInfo?.username)
        next();
    else
        res.status(401).json({ message: "You were logged out, Log in please" });
});
/* admin kick — any session created before the user's revocation stamp is dead */
router.use((req, res, next) => {
    const user = req.session?.userInfo;
    if (user && (0, sessionGuard_1.isRevoked)(user.username, user.loginAt)) {
        req.session.destroy(() => { });
        return res.status(401).json({ message: "You were logged out, Log in please" });
    }
    next();
});
/* while the seeded default admin still uses the hardcoded password,
 * only profile + password change endpoints are available */
router.use((req, res, next) => {
    const user = req.session?.userInfo;
    if (user?.mustChangePassword && !["/users/me", "/changePassword"].includes(req.path)) {
        return res.status(403).json({ code: "password_change_required", message: "client_error.password_change_required" });
    }
    next();
});
router.post("/changePassword", UserController_1.changePassword);
router.post("/soundPref", UserController_1.updateSoundPref);
router.post("/langPref", UserController_1.updateLangPref);
/* Users Route */
router.get("/users", UserController_1.getUsers);
router.post("/users", UserController_1.addUser);
router.post("/users/kick", UserController_1.kickUser);
router.get("/users/me", UserController_1.getLoggedInUserInfo);
router.delete("/users/:id", UserController_1.removeUser);
router.put("/users/:id/make-admin", UserController_1.makeUserAdmin);
router.put("/users/:id/make-user", UserController_1.makeUserRegular);
router.put("/users/:id/suspend", UserController_1.suspendUser);
router.put("/users/:id/approve", UserController_1.unsuspendUser);
router.get("/chat/getNotice", SettingController_1.getNotice);
router.get("/chat/getAdjustHijri", SettingController_1.getHijriAdjustment);
router.put("/chat/adjustHijri", SettingController_1.saveAdjustedHijri);
router.get("/chat/getFrequentSymbols", SettingController_1.getFrequentSymbols);
router.post("/chat/restoreFrequentSymbols", SettingController_1.restoreFrequentSymbols);
router.put("/chat/saveFrequentSymbols", SettingController_1.saveFrequentSymbols);
router.post("/chat/getMessages", ChatController_1.getMessages);
router.post("/chat/getMissingMessages", ChatController_1.getMissingMessages);
router.put("/chat/updateNotice", SettingController_1.updateNotice);
// fullscreen login notice — read by any logged-in user, written by admins only
router.get("/chat/getFsNotice", SettingController_1.getFsNotice);
router.put("/chat/updateFsNotice", SettingController_1.updateFsNotice);
router.get("/chat/download-json", SettingController_1.downloadChat);
router.get("/chat/download", SettingController_1.downloadFormatted);
// full-history export available to every logged-in user (unless the admin
// restricted it to admins — enforced inside the controller)
router.get("/chat/export", ChatController_1.exportChat);
// addon feature visibility + its admin toggles
router.get("/chat/visibility", SettingController_1.getVisibility);
router.put("/chat/admin-settings", SettingController_1.saveAdminSettings);
router.get("/chat/admin-settings", SettingController_1.getAdminSettings);
// attendance counter — the admin edits the raw html, GET /attendance renders it
router.get("/chat/attendance", SettingController_1.getAttendanceSettings);
router.put("/chat/attendance", SettingController_1.saveAttendanceHtml);
router.put("/chat/enable", SettingController_1.enableChat);
router.put("/chat/disable", SettingController_1.disableChat);
router.get("/chat/canChat", SettingController_1.canWeChat);
router.delete("/chat/delete", SettingController_1.deleteChat);
router.get("/hijri", SettingController_1.getHijri);
module.exports = router;

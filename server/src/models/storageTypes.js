"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StorageTypes = exports.StorageModels = void 0;
var StorageModels;
(function (StorageModels) {
    StorageModels["User"] = "User";
    StorageModels["Setting"] = "Setting";
    StorageModels["Message"] = "Message";
})(StorageModels || (exports.StorageModels = StorageModels = {}));
var StorageTypes;
(function (StorageTypes) {
    StorageTypes["ptStorage"] = "ptStorage";
    StorageTypes["diskStorage"] = "diskStorage";
    StorageTypes["githubGistStorage"] = "githubGistStorage";
})(StorageTypes || (exports.StorageTypes = StorageTypes = {}));

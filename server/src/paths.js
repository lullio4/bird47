"use strict";
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PROJECT_ROOT = exports.DATA_DIR = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
/**
 * Resolve the project root regardless of how the code runs:
 * - bundled:  <root>/index.js        → __dirname = <root>
 * - dev:      <root>/server/src/*.js → __dirname = <root>/server/src
 */
function findProjectRoot() {
    const candidates = [
        __dirname,
        (0, path_1.resolve)(__dirname, ".."),
        (0, path_1.resolve)(__dirname, "..", ".."),
        process.cwd(),
    ];
    for (const c of candidates) {
        if ((0, fs_1.existsSync)((0, path_1.join)(c, "public", "index.html")))
            return c;
    }
    return process.cwd();
}
const PROJECT_ROOT = findProjectRoot();
exports.PROJECT_ROOT = PROJECT_ROOT;
// storage folder can be relocated via env (e.g. a mounted Render disk)
const DATA_DIR = process.env.DATA_DIR ? (0, path_1.resolve)(process.env.DATA_DIR) : (0, path_1.join)(PROJECT_ROOT, "data");
exports.DATA_DIR = DATA_DIR;

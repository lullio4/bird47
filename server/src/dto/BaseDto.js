"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BaseDto = void 0;
class BaseDto {
    id = "";
    constructor(data) {
        if (!data)
            return;
        this.id = data.id;
    }
}
exports.BaseDto = BaseDto;

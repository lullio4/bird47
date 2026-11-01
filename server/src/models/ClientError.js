"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ClientError = void 0;
/**
 * Custom Error class to send meaningful response to client from service layer
 * Instead of direct response message, lang value has been used here.
 * Please refer to lang/lang_file for more information.
 */
class ClientError {
    code;
    message;
    data;
    constructor(code, message, data) {
        this.code = code;
        this.message = message;
        if (data)
            this.data = data;
    }
    static invalidError() {
        return new ClientError(414, "client_error.invalid_error");
    }
    static WrongPassword() {
        return new ClientError(401, "client_error.wrong_password");
    }
    static invalidCredentials() {
        return new ClientError(403, "client_error.invalid_credentials");
    }
    static inactiveUser() {
        return new ClientError(400, "client_error.inactive_user");
    }
    static duplicateError() {
        return new ClientError(400, "client_error.duplicate_error");
    }
    static notExistsError() {
        return new ClientError(404, "client_error.not_exists_error");
    }
    static accessDeniedError() {
        return new ClientError(403, "client_error.access_denied");
    }
    static connectionFailedError() {
        return new ClientError(504, "client_error.connection_failed_error");
    }
    static passwordsNotIdenticalError() {
        return new ClientError(400, "client_error.passwords_not_identical_error");
    }
    static internalError() {
        return new ClientError(500, "client_error.internal_error");
    }
    static tooLargeError() {
        return new ClientError(413, "client_error.too_large_error");
    }
    static passwordChangeRequiredError() {
        return new ClientError(403, "client_error.password_change_required");
    }
}
exports.ClientError = ClientError;

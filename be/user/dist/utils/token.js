"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const signAccessToken = (user) => {
    return jsonwebtoken_1.default.sign({ user }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
};
exports.signAccessToken = signAccessToken;
const signRefreshToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "15d" });
};
exports.signRefreshToken = signRefreshToken;

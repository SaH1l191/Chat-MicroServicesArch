"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getAllUsers = exports.updateName = exports.getUser = exports.getAUser = exports.refreshAccessToken = exports.verifyUser = exports.login = void 0;
const __1 = require("..");
const otp_agent_1 = require("otp-agent");
const rabbitmq_1 = require("../config/rabbitmq");
const User_1 = require("../models/User");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const token_1 = require("../utils/token");
dotenv_1.default.config();
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Please provide all fields' });
        }
        //reDis 
        // 2 keys : 
        //otp:ratelimit:email@example.com : true/false
        // otp:email@example.com : 123123123
        const rateLimitKey = `otp:ratelimit:${email}`;
        const rateLimit = yield __1.redisClient.get(rateLimitKey);
        if (rateLimit) {
            res.status(429).json({
                message: 'You are sending too many requests'
            });
            return;
        }
        const otp = (0, otp_agent_1.generateOTP)({
            length: 8,
            numbers: true,
            alphabets: true,
            upperCaseAlphabets: true,
        });
        const otpKey = `otp:${email}`;
        yield __1.redisClient.set(otpKey, otp, {
            EX: 300
        });
        yield __1.redisClient.set(rateLimitKey, "true", {
            EX: 60
        });
        const message = {
            to: email,
            subject: "Your OTP Code",
            body: `Your OTP Code is ${otp}.It will expire after 5 minutes`
        };
        yield (0, rabbitmq_1.publishToQueue)('send-otp', message);
        res.status(400).json({
            message: "OTP sent successfully"
        });
    }
    catch (error) {
        console.log("Error in login", error);
        // return res.status(500).json({message: error.message});
    }
});
exports.login = login;
const verifyUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: "Please provide all fields" });
        }
        //otpkey in form
        //otp:haldankarsahil98@gmail.com
        const otpKey = `otp:${email}`;
        const storedOtp = yield __1.redisClient.get(otpKey);
        if (!storedOtp || storedOtp !== otp) {
            return res.status(400).json({
                message: "Invalid or Expired OTP"
            });
        }
        yield __1.redisClient.del(otpKey);
        let user = yield User_1.User.findOne({ email: email });
        if (!user) {
            const name = email.slice(0, email.indexOf('@'));
            user = yield User_1.User.create({ name: name, email });
            // const token = await jwt.sign({ user }, process.env.JWT_SECRET!, { expiresIn: "15d" })
            const accessToken = (0, token_1.signAccessToken)(user);
            const refreshToken = (0, token_1.signRefreshToken)(user._id.toString());
            //refresh:USER_ID: REFRESH_TOKEN (15 days expiry)
            yield __1.redisClient.set(`refresh:${user._id}`, refreshToken, { EX: 15 * 24 * 60 * 60 });
            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                sameSite: "lax", // instead of "strict"
                secure: false,
                maxAge: 15 * 60 * 1000 // 15 days
            });
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: false,
                maxAge: 15 * 24 * 60 * 60 * 1000
            });
            return res.status(200).json({
                message: "User Verified",
                user
            });
        }
        else {
            //user already exists 
            const accessToken = (0, token_1.signAccessToken)(user);
            const refreshToken = (0, token_1.signRefreshToken)(user._id.toString());
            yield __1.redisClient.set(`refresh:${user._id}`, refreshToken, { EX: 15 * 24 * 60 * 60 });
            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 15 * 60 * 1000
            });
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 15 * 24 * 60 * 60 * 1000
            });
            return res.status(200).json({
                message: "User Verified",
                user
            });
        }
    }
    catch (error) {
        console.log("Error in verifying User", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.verifyUser = verifyUser;
// Access token
// Short-lived (10–15 min)
// Used on every API request
// If stolen → limited damage
// Refresh token
// Long-lived (7–30 days)
// Used only to get new access tokens
// Stored securely (HTTP-only cookie)
// Flow 
// User logs in
// ↓
// Access token (15 min) + Refresh token (15 days)
// ↓
// 15 minutes later
// ↓
// API returns 401 (Access token expired)
// ↓
// Frontend calls /auth/refresh
// ↓
// New access token issued
// ↓
// User continues without logging in again
const refreshAccessToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const refreshToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
        if (!refreshToken)
            return res.status(401).json({ message: "No refresh token" });
        const payload = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const savedToken = yield __1.redisClient.get(`refresh:${payload.userId}`);
        if (savedToken && savedToken !== refreshToken) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }
        const user = yield User_1.User.findById(payload.userId);
        if (!user)
            return res.status(401).json({ message: "User not found" });
        const newAccessToken = (0, token_1.signAccessToken)(user);
        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 15 * 60 * 1000
        });
        res.json({ message: "Access token refreshed" });
    }
    catch (_b) {
        return res.status(401).json({ message: "Refresh expired" });
    }
});
exports.refreshAccessToken = refreshAccessToken;
const getAUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = yield User_1.User.findById(id);
        if (!user) {
            return res.status(200).json({
                message: "Invalid User "
            });
        }
        return res.status(200).json({
            user
        });
    }
    catch (error) {
        console.log("Error in getting User", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.getAUser = getAUser;
const getUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        console.log("/me user ", req.user);
        return res.status(200).json({
            user
        });
    }
    catch (error) {
        console.log("Error in getting User", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.getUser = getUser;
const updateName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const user = yield User_1.User.findById({ _id: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id });
        if (!user) {
            return res.status(200).json({
                message: "Please Login"
            });
        }
        user.name = req.body.name;
        yield user.save();
        const token = yield jsonwebtoken_1.default.sign({ user }, process.env.JWT_SECRET, { expiresIn: "15d" });
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 15 * 24 * 60 * 60 * 1000
        });
        res.json({
            message: "User Updated",
            user,
            token
        });
    }
    catch (error) {
        console.log("Error in getting User", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.updateName = updateName;
const getAllUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield User_1.User.find();
        return res.status(200).json({
            message: "fetched all Users successfully",
            users
        });
    }
    catch (error) {
        console.log("Error in getting all users", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.getAllUsers = getAllUsers;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) {
        yield __1.redisClient.del(`refresh:${req.user._id}`);
    }
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
});
exports.logout = logout;

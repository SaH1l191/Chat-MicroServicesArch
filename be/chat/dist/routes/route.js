"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chat_1 = require("../controller/chat");
const auth_1 = require("../middleware/auth");
const multer_1 = require("../middleware/multer");
const router = express_1.default.Router();
router.post('/chat/new', auth_1.authMiddleware, chat_1.createNewChat);
router.get("/chat/all", auth_1.authMiddleware, chat_1.getAllChats);
router.post("/message", auth_1.authMiddleware, multer_1.upload.single('image'), chat_1.sendMessage);
router.get("/message/:id", auth_1.authMiddleware, chat_1.sendMessage);
exports.default = router;

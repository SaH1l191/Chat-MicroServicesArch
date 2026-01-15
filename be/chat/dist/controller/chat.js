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
exports.getMessageByChat = exports.sendMessage = exports.getAllChats = exports.createNewChat = void 0;
const Chat_1 = require("../models/Chat");
const Message_1 = require("../models/Message");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const socket_1 = require("../socket/socket");
const rabbitmq_1 = require("../config/rabbitmq");
dotenv_1.default.config();
const createNewChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a._id;
        const { otherUserId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        if (!otherUserId) {
            return res.status(400).json({ message: "Other user ID is required" });
        }
        const existingChat = yield Chat_1.Chat.findOne({
            users: { $all: [userId, otherUserId], $size: 2 }
        });
        if (existingChat) {
            return res.json({
                messaeg: "Chat already exists",
                chatId: existingChat._id
            });
        }
        const newChat = yield Chat_1.Chat.create({
            users: [userId, otherUserId]
        });
        const otherUserSocketId = socket_1.userSocketMap[otherUserId.toString()];
        if (otherUserSocketId) {
            socket_1.io.to(otherUserSocketId).emit('chat:new', {
                chatId: newChat._id.toString(),
                createdBy: userId.toString()
            });
        }
        return res.status(200).json({
            message: "New Chat Created",
            chatId: newChat._id
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error" });
    }
});
exports.createNewChat = createNewChat;
const getAllChats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        const chats = yield Chat_1.Chat.find({ users: userId }).sort({ updated: -1 });
        //Promise.all ensures:
        // parallel DB + HTTP calls
        // faster response time than sequential await
        // console.log("Chats : ",chats)
        const chatWithUserData = yield Promise.all(chats.map((chat) => __awaiter(void 0, void 0, void 0, function* () {
            const otherUserId = chat.users.find((id) => id.toString() !== userId.toString());
            const unseenCount = yield Message_1.Message.countDocuments({
                chatId: chat._id,
                sender: { $ne: userId },
                seen: false
            });
            try {
                const baseUrl = process.env.NEXT_PUBLIC_CODEBASE === "production" ? process.env.NEXT_USER_SERVICE_APP_URL : "http://localhost:3000";
                const { data } = yield axios_1.default.get(`${baseUrl}/api/v1/user/${otherUserId}`);
                // console.log(`api to : ${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`)
                // console.log("Data from user service ", data)
                // Extract user from response - user service returns { user: {...} }
                const userData = data.user || data;
                return {
                    user: userData,
                    chat: Object.assign(Object.assign({}, chat.toObject()), { latestMessage: chat.latestMessage || null, unseenCount })
                };
            }
            catch (error) {
                //fallback if user service fails 
                console.log("error ", error);
                return {
                    user: {
                        _id: otherUserId, name: "Unknown User"
                    },
                    chat: Object.assign(Object.assign({}, chat.toObject()), { latestMessage: chat.latestMessage || null, unseenCount })
                };
            }
        })));
        // no empty chats 
        const filteredChats = chatWithUserData.filter((chat) => chat !== null);
        // console.log("chatWithUserData : ",filteredChats)
        return res.json({
            chats: filteredChats
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error in getting chats" });
    }
});
exports.getAllChats = getAllChats;
const sendMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const senderId = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a._id;
        const { chatId, text } = req.body;
        const imageFile = req.file;
        if (!senderId) {
            return res.status(400).json({ message: "Sender ID is required" });
        }
        if (!chatId) {
            return res.status(400).json({ message: "Chat ID is required" });
        }
        if (!text && !imageFile) {
            return res.status(400).json({ message: "Message or image is required" });
        }
        const chat = yield Chat_1.Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }
        const isUserInChat = chat.users.some((userId) => userId.toString() === senderId.toString());
        if (!isUserInChat) {
            return res.status(403).json({ message: "You are not a part of this chat" });
        }
        const otherUserId = chat.users.find((userId) => userId.toString() !== senderId.toString());
        if (!otherUserId) {
            return res.status(403).json({ message: "No other user found in this chat" });
        }
        // Prepare message payload for worker
        let messagePayload = {
            chatId: chatId,
            senderId: senderId.toString(),
            seen: false,
            seenAt: undefined
        };
        if (imageFile) {
            messagePayload.image = {
                url: imageFile.path,
                publicId: imageFile.filename
            };
            messagePayload.messageType = "image";
            messagePayload.text = text || "";
        }
        else {
            messagePayload.text = text;
            messagePayload.messageType = "text";
        }
        // Publish to queue - worker will handle everything
        yield (0, rabbitmq_1.publishToQueue)(messagePayload);
        // Return immediately - worker handles storage, delivery, and notifications
        // Fetch current messages for response
        const messages = yield Message_1.Message.find({ chatId }).sort({ createdAt: 1 });
        const updatedChat = yield Chat_1.Chat.findById(chatId);
        return res.status(201).json({
            message: {
                chatId,
                sender: senderId,
                text: messagePayload.text,
                image: messagePayload.image,
                messageType: messagePayload.messageType,
                seen: false
            },
            messages,
            chat: updatedChat,
            sender: senderId
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error in sending message" });
    }
});
exports.sendMessage = sendMessage;
const getMessageByChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const { chatId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        const chat = yield Chat_1.Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }
        const isUserInChat = chat.users.some((id) => id.toString() === userId.toString());
        if (!isUserInChat) {
            return res.status(403).json({ message: "You are not a part of this chat" });
        }
        //when user clicks the chats, all the unseen messsages
        //mark them seen 
        //read receipt feature
        yield Message_1.Message.updateMany({
            chatId: chatId,
            sender: { $ne: userId },
            seen: false
        }, {
            seen: true,
            seenAt: new Date()
        });
        //ascending order 
        const messages = yield Message_1.Message.find({ chatId }).sort({ createdAt: 1 });
        const otherUserId = chat.users.find((id) => id.toString() !== userId.toString());
        console.log("Other Used Id ", otherUserId);
        if (!otherUserId) {
            return res.status(404).json({ message: "No Other User" });
        }
        try {
            const baseUrl = process.env.NEXT_PUBLIC_CODEBASE === "production" ? process.env.NEXT_USER_SERVICE_APP_URL : "http://localhost:3000";
            const { data } = yield axios_1.default.get(`${baseUrl}/api/v1/user/${otherUserId}`);
            const userData = data.user || data;
            return res.status(200).json({
                messages,
                user: userData
            });
        }
        catch (error) {
            return res.status(200).json({ messages, user: { _id: otherUserId, name: "Unknown User" } });
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error in getting messages" });
    }
});
exports.getMessageByChat = getMessageByChat;

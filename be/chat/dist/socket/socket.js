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
exports.io = exports.server = exports.app = exports.viewingChatMap = exports.userSocketMap = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
const Message_1 = require("../models/Message");
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CODEBASE === "production" ? process.env.FRONTEND_URL : 'http://localhost:3003',
        credentials: true,
        methods: ['GET', 'POST']
    }
});
exports.io = io;
exports.userSocketMap = {}; // userID : socketId
exports.viewingChatMap = {}; // userID : chatId (user watching which chatId)
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    const userId = socket.handshake.query.userId;
    if (userId && userId !== null) {
        exports.userSocketMap[userId] = socket.id;
        console.log(`User ${userId} is connected with socket id ${socket.id}`);
    }
    io.emit('getOnlineUsers', Object.keys(exports.userSocketMap));
    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
        for (const userId in exports.userSocketMap) {
            if (exports.userSocketMap[userId] === socket.id) {
                console.log("User disconnected", userId, "with socket id ", socket.id);
                delete exports.userSocketMap[userId];
                delete exports.viewingChatMap[userId];
                io.emit('getOnlineUsers', Object.keys(exports.userSocketMap));
                break;
            }
        }
    });
    socket.on('connect-error', (error) => {
        console.log('Connect error', error);
    });
    socket.on('join:chat', (chatId) => {
        socket.join(`chat:${chatId}`);
        const userId = socket.handshake.query.userId;
        console.log(`User ${userId} joined chat room: chat:${chatId}`);
        socket.to(`chat:${chatId}`).emit('user:joined:room', { chatId, userId });
    });
    socket.on('leave:chat', (chatId) => {
        socket.leave(`chat:${chatId}`);
        const userId = socket.handshake.query.userId;
        console.log(`User ${userId} left chat room: chat:${chatId}`);
    });
    socket.on('viewing:chat', (chatId) => {
        const userId = socket.handshake.query.userId;
        if (userId) {
            exports.viewingChatMap[userId] = chatId;
            console.log(`User ${userId} is now viewing chat: ${chatId}`);
        }
    });
    socket.on('not:viewing:chat', () => {
        const userId = socket.handshake.query.userId;
        if (userId) {
            delete exports.viewingChatMap[userId];
            console.log(`User ${userId} stopped viewing chat`);
        }
    });
    socket.on('typing:start', (data) => {
        const { chatId, userId } = data;
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: true });
    });
    socket.on('typing:stop', (data) => {
        const { chatId, userId } = data;
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: false });
    });
    // Removed 'message:sent' handler - worker now handles WebSocket delivery
    // This prevents duplicate message emissions
    socket.on('message:read', (data) => __awaiter(void 0, void 0, void 0, function* () {
        const { chatId, messageIds } = data;
        const userId = socket.handshake.query.userId;
        if (!userId)
            return;
        yield Message_1.Message.updateMany({ _id: { $in: messageIds }, chatId }, { seen: true, seenAt: new Date() });
        socket.to(`chat:${chatId}`).emit('message:read', { chatId, messageIds });
    }));
});

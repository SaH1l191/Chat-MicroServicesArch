"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CODEBASE === "production" ? process.env.FRONTEND_URL : 'http://localhost:3003',
        credentials: true,
        methods: ['GET', 'POST']
    }
});
exports.io = io;
const userSocketMap = {};
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    const userId = socket.handshake.query.userId;
    if (userId && userId !== null) {
        userSocketMap[userId] = socket.id;
        console.log(`User ${userId} is connected with socket id ${socket.id}`);
    }
    io.emit('getOnlineUsers', Object.keys(userSocketMap));
    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
        for (const userId in userSocketMap) {
            if (userSocketMap[userId] === socket.id) {
                console.log("User disconnected", userId, "with socket id ", socket.id);
                delete userSocketMap[userId];
                io.emit('getOnlineUsers', Object.keys(userSocketMap));
                break;
            }
        }
    });
    socket.on('connect-error', (error) => {
        console.log('Connect error', error);
    });
    socket.on('join:chat', (chatId) => {
        socket.join(`chat:${chatId}`);
        console.log(`User ${userId} joined chat room: chat:${chatId}`);
    });
    socket.on('leave:chat', (chatId) => {
        socket.leave(`chat:${chatId}`);
        console.log(`User ${userId} left chat room: chat:${chatId}`);
    });
    socket.on('typing:start', (data) => {
        const { chatId, userId } = data;
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: true });
    });
    socket.on('typing:stop', (data) => {
        const { chatId, userId } = data;
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: false });
    });
});

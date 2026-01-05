"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const route_1 = __importDefault(require("./routes/route"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const socket_1 = require("./socket/socket");
dotenv_1.default.config();
//mounting everything on app except need to listen on server 
// because app used for routing , socket used for websockets 
socket_1.app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3003', // Next.js default port
    credentials: true, // Important for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
socket_1.app.use(express_1.default.json());
socket_1.app.use((0, cookie_parser_1.default)());
socket_1.app.use('/api/v1', route_1.default);
(0, db_1.default)();
const PORT = process.env.PORT || 3000;
socket_1.server.listen(PORT, () => {
    console.log(`Chat service listening at port ${PORT}`);
});

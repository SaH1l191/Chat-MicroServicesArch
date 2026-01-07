"use strict";
// MAIL INDEX.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const consumer_1 = require("./consumer");
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
(0, consumer_1.sendOtpConsumer)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.CODEBASE === "production" ? process.env.FRONTEND_URL : 'http://localhost:3003', // Next.js default port
    credentials: true, // Important for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Mail service listening at port ${PORT}`);
});
app.get('/', (req, res) => {
    res.send('Mail Service is running');
});

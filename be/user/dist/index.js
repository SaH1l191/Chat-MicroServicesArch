"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const redis_1 = require("redis");
const rabbitmq_1 = require("./config/rabbitmq");
const user_1 = __importDefault(require("./routes/user"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// CORS configuration - allow requests from frontend
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3003', // Next.js default port
    credentials: true, // Important for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use("/api/v1", user_1.default);
(0, db_1.default)();
(0, rabbitmq_1.connectRabbitMq)();
exports.redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL
});
exports.redisClient.connect()
    .then(() => console.log("Redis connected"))
    .catch((err) => console.error("Redis connection error", err));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`User service listening at port ${PORT}`);
});

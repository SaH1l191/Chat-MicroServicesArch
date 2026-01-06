"use strict";
// MAIL INDEX.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const consumer_1 = require("./consumer");
dotenv_1.default.config();
(0, consumer_1.sendOtpConsumer)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Mail service listening at port ${PORT}`);
});
app.get('/', (req, res) => {
    res.send('Mail Service is running');
});

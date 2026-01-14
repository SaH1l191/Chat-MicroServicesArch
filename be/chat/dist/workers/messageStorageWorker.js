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
exports.startMessageStorageWorker = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const Message_1 = require("../models/Message");
const Chat_1 = require("../models/Chat");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const QUEUE_NAME = 'chat:message:storage';
const startMessageStorageWorker = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connectionUrl = process.env.Rabbitmq_URL || 'amqp://localhost:5672';
        const connection = yield amqplib_1.default.connect(connectionUrl);
        const channel = yield connection.createChannel();
        yield channel.assertQueue(QUEUE_NAME, { durable: true });
        // Prefetch 1 message at a time for better load distribution
        channel.prefetch(1);
        console.log(`[Storage Worker] Waiting for messages in queue: ${QUEUE_NAME}`);
        channel.consume(QUEUE_NAME, (msg) => __awaiter(void 0, void 0, void 0, function* () {
            if (!msg)
                return;
            try {
                const payload = JSON.parse(msg.content.toString());
                console.log(`[Storage Worker] Processing message for chat: ${payload.chatId}`);
                // Save message to database
                const messageData = {
                    chatId: payload.chatId,
                    sender: payload.senderId,
                    seen: payload.seen,
                    seenAt: payload.seenAt,
                    messageType: payload.messageType,
                };
                if (payload.text) {
                    messageData.text = payload.text;
                }
                if (payload.image) {
                    messageData.image = payload.image;
                }
                const message = new Message_1.Message(messageData);
                const savedMessage = yield message.save();
                // Update chat's latest message
                const latestMessageText = payload.image ? "📷 Image" : (payload.text || "");
                yield Chat_1.Chat.findByIdAndUpdate(payload.chatId, {
                    latestMessage: {
                        text: latestMessageText,
                        sender: payload.senderId,
                    },
                    updatedAt: new Date()
                }, { new: true });
                console.log(`[Storage Worker] Message saved with ID: ${savedMessage._id}`);
                // Acknowledge message processing
                channel.ack(msg);
            }
            catch (error) {
                console.error(`[Storage Worker] Error processing message:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        }));
        // Handle connection errors
        connection.on('error', (err) => {
            console.error('[Storage Worker] RabbitMQ connection error:', err);
        });
        connection.on('close', () => {
            console.log('[Storage Worker] RabbitMQ connection closed');
        });
    }
    catch (error) {
        console.error('[Storage Worker] Failed to start worker:', error);
        // Retry after 5 seconds
        setTimeout(() => (0, exports.startMessageStorageWorker)(), 5000);
    }
});
exports.startMessageStorageWorker = startMessageStorageWorker;

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
exports.startMessageDeliveryWorker = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const socket_1 = require("../socket/socket");
const Message_1 = require("../models/Message");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const QUEUE_NAME = 'chat:message:delivery';
const startMessageDeliveryWorker = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connectionUrl = process.env.Rabbitmq_URL || 'amqp://localhost:5672';
        const connection = yield amqplib_1.default.connect(connectionUrl);
        const channel = yield connection.createChannel();
        yield channel.assertQueue(QUEUE_NAME, { durable: true });
        // Prefetch 1 message at a time
        channel.prefetch(1);
        console.log(`[Delivery Worker] Waiting for messages in queue: ${QUEUE_NAME}`);
        channel.consume(QUEUE_NAME, (msg) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            if (!msg)
                return;
            try {
                const payload = JSON.parse(msg.content.toString());
                console.log(`[Delivery Worker] Delivering message for chat: ${payload.chatId}`);
                // Fetch the saved message from DB (storage worker should have saved it by now)
                // We'll retry a few times in case storage worker hasn't finished yet
                let savedMessage = null;
                let retries = 3;
                while (retries > 0 && !savedMessage) {
                    // Find the most recent message for this chat from this sender
                    const messages = yield Message_1.Message.find({
                        chatId: payload.chatId,
                        sender: payload.senderId
                    }).sort({ createdAt: -1 }).limit(1);
                    if (messages.length > 0) {
                        // Check if it matches our payload (by checking text/image and timestamp)
                        const candidate = messages[0];
                        const matches = (payload.text && candidate.text === payload.text) ||
                            (payload.image && ((_a = candidate.image) === null || _a === void 0 ? void 0 : _a.publicId) === payload.image.publicId);
                        if (matches) {
                            savedMessage = candidate;
                            break;
                        }
                    }
                    // Wait a bit before retrying
                    yield new Promise(resolve => setTimeout(resolve, 100));
                    retries--;
                }
                if (savedMessage) {
                    // Deliver message via WebSocket
                    socket_1.io.to(`chat:${payload.chatId}`).emit('message:new', {
                        message: savedMessage,
                        chatId: payload.chatId,
                        senderId: payload.senderId
                    });
                    console.log(`[Delivery Worker] Message delivered via WebSocket: ${savedMessage._id}`);
                }
                else {
                    console.warn(`[Delivery Worker] Could not find saved message for chat: ${payload.chatId}`);
                }
                // Acknowledge message processing
                channel.ack(msg);
            }
            catch (error) {
                console.error(`[Delivery Worker] Error delivering message:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        }));
        // Handle connection errors
        connection.on('error', (err) => {
            console.error('[Delivery Worker] RabbitMQ connection error:', err);
        });
        connection.on('close', () => {
            console.log('[Delivery Worker] RabbitMQ connection closed');
        });
    }
    catch (error) {
        console.error('[Delivery Worker] Failed to start worker:', error);
        // Retry after 5 seconds
        setTimeout(() => (0, exports.startMessageDeliveryWorker)(), 5000);
    }
});
exports.startMessageDeliveryWorker = startMessageDeliveryWorker;

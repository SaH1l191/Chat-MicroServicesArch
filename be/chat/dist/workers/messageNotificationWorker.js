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
exports.startMessageNotificationWorker = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const socket_1 = require("../socket/socket");
const Message_1 = require("../models/Message");
const dotenv_1 = __importDefault(require("dotenv"));
const Chat_1 = require("../models/Chat");
dotenv_1.default.config();
const QUEUE_NAME = 'chat:message:notification';
const startMessageNotificationWorker = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connectionUrl = process.env.Rabbitmq_URL || 'amqp://localhost:5672';
        const connection = yield amqplib_1.default.connect(connectionUrl);
        const channel = yield connection.createChannel();
        yield channel.assertQueue(QUEUE_NAME, { durable: true });
        // Prefetch 1 message at a time
        channel.prefetch(1);
        console.log(`[Notification Worker] Waiting for messages in queue: ${QUEUE_NAME}`);
        channel.consume(QUEUE_NAME, (msg) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            if (!msg)
                return;
            try {
                const payload = JSON.parse(msg.content.toString());
                console.log(`[Notification Worker] Processing notification for chat: ${payload.chatId}`);
                // Find the receiver (other user in the chat)
                // We need to get chat info to find the receiver
                const chat = yield Chat_1.Chat.findById(payload.chatId);
                if (!chat) {
                    console.warn(`[Notification Worker] Chat not found: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }
                const receiverId = (_a = chat.users.find((userId) => userId.toString() !== payload.senderId.toString())) === null || _a === void 0 ? void 0 : _a.toString();
                if (!receiverId) {
                    console.warn(`[Notification Worker] No receiver found for chat: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }
                // Check if receiver is online
                const receiverSocketId = socket_1.userSocketMap[receiverId];
                const isReceiverOnline = !!receiverSocketId;
                // Ensure both are strings for comparison
                const currentViewingChat = socket_1.viewingChatMap[receiverId];
                const isReceiverViewingChat = currentViewingChat &&
                    currentViewingChat.toString() === payload.chatId.toString();
                if (isReceiverOnline) {
                    // If receiver is viewing THIS SPECIFIC chat, mark as seen immediately
                    if (isReceiverViewingChat) {
                        // Double-check: Verify they're actually in the chat room
                        const receiverSocket = socket_1.io.sockets.sockets.get(receiverSocketId);
                        if (receiverSocket) {
                            const isInRoom = Array.from(receiverSocket.rooms).includes(`chat:${payload.chatId}`);
                            if (isInRoom) {
                                // Wait a bit for storage worker to save the message
                                yield new Promise(resolve => setTimeout(resolve, 200));
                                // Find the message and mark as seen
                                const messages = yield Message_1.Message.find({
                                    chatId: payload.chatId,
                                    sender: payload.senderId.toString()
                                }).sort({ createdAt: -1 }).limit(1);
                                if (messages.length > 0) {
                                    const message = messages[0];
                                    // Only mark as seen if it's not already seen
                                    if (!message.seen) {
                                        yield Message_1.Message.findByIdAndUpdate(message._id, {
                                            seen: true,
                                            seenAt: new Date()
                                        });
                                        socket_1.io.to(`chat:${payload.chatId}`).emit('message:read', {
                                            chatId: payload.chatId,
                                            messageIds: [message._id.toString()]
                                        });
                                        console.log(`[Notification Worker] Message marked as seen: ${message._id}`);
                                    }
                                }
                            }
                        }
                    }
                    else {
                        // Receiver is online but not viewing this chat - send refresh notification
                        socket_1.io.to(receiverSocketId).emit('chat:refresh', {
                            chatId: payload.chatId,
                            message: {
                                _id: payload.chatId, // Placeholder, will be updated when they fetch
                                chatId: payload.chatId,
                                sender: payload.senderId,
                                text: payload.text,
                                image: payload.image,
                                messageType: payload.messageType
                            }
                        });
                        console.log(`[Notification Worker] Sent chat refresh notification to user: ${receiverId}`);
                    }
                }
                else {
                    // Receiver is offline - could send push notification here
                    // For now, just log it
                    console.log(`[Notification Worker] Receiver ${receiverId} is offline - push notification could be sent here`);
                    // TODO: Integrate with push notification service (FCM, APNS, etc.)
                }
                // Acknowledge message processing
                channel.ack(msg);
            }
            catch (error) {
                console.error(`[Notification Worker] Error processing notification:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        }));
        // Handle connection errors
        connection.on('error', (err) => {
            console.error('[Notification Worker] RabbitMQ connection error:', err);
        });
        connection.on('close', () => {
            console.log('[Notification Worker] RabbitMQ connection closed');
        });
    }
    catch (error) {
        console.error('[Notification Worker] Failed to start worker:', error);
        // Retry after 5 seconds
        setTimeout(() => (0, exports.startMessageNotificationWorker)(), 5000);
    }
});
exports.startMessageNotificationWorker = startMessageNotificationWorker;

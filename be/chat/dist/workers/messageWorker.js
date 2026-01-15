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
exports.startMessageWorker = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const socket_1 = require("../socket/socket");
const Message_1 = require("../models/Message");
const Chat_1 = require("../models/Chat");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const QUEUE_NAME = 'chat:messages';
/**
 * Handles: Storage -> Delivery -> Notifications in sequence
 */
const startMessageWorker = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connectionUrl = process.env.Rabbitmq_URL;
        const connection = yield amqplib_1.default.connect(connectionUrl);
        const channel = yield connection.createChannel();
        yield channel.assertQueue(QUEUE_NAME, { durable: true });
        channel.prefetch(1);
        console.log(`[Message Worker] Waiting for messages in queue: ${QUEUE_NAME}`);
        channel.consume(QUEUE_NAME, (msg) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            if (!msg)
                return;
            try {
                const payload = JSON.parse(msg.content.toString());
                console.log(`[Message Worker] Processing message for chat: ${payload.chatId}`);
                // Step 1: Save message to database
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
                const latestMessageText = payload.image ? "📷 Image" : (payload.text || "");
                yield Chat_1.Chat.findByIdAndUpdate(payload.chatId, {
                    latestMessage: {
                        text: latestMessageText,
                        sender: payload.senderId,
                    },
                    updatedAt: new Date()
                }, { new: true });
                console.log(`[Message Worker] Message saved: ${savedMessage._id}`);
                // Step 2: Deliver message via WebSocket
                const messageToSend = Object.assign(Object.assign({}, savedMessage.toObject()), { createdAt: savedMessage.createdAt ? new Date(savedMessage.createdAt).toISOString() : new Date().toISOString() });
                socket_1.io.to(`chat:${payload.chatId}`).emit('message:new', {
                    message: messageToSend,
                    chatId: payload.chatId,
                    senderId: payload.senderId
                });
                console.log(`[Message Worker] Message delivered via WebSocket`);
                // Step 3: Handle notifications and read receipts
                const chat = yield Chat_1.Chat.findById(payload.chatId);
                if (!chat) {
                    console.warn(`[Message Worker] Chat not found: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }
                const receiverId = (_a = chat.users.find((userId) => userId.toString() !== payload.senderId.toString())) === null || _a === void 0 ? void 0 : _a.toString();
                if (!receiverId) {
                    console.warn(`[Message Worker] No receiver found for chat: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }
                const receiverSocketId = socket_1.userSocketMap[receiverId];
                const isReceiverOnline = !!receiverSocketId;
                const currentViewingChat = socket_1.viewingChatMap[receiverId];
                const isReceiverViewingChat = currentViewingChat &&
                    currentViewingChat.toString() === payload.chatId.toString();
                if (isReceiverOnline) {
                    // If receiver is viewing THIS chat, mark as seen immediately
                    if (isReceiverViewingChat) {
                        const receiverSocket = socket_1.io.sockets.sockets.get(receiverSocketId);
                        if (receiverSocket) {
                            const isInRoom = Array.from(receiverSocket.rooms).includes(`chat:${payload.chatId}`);
                            if (isInRoom && !savedMessage.seen) {
                                yield Message_1.Message.findByIdAndUpdate(savedMessage._id, {
                                    seen: true,
                                    seenAt: new Date()
                                });
                                socket_1.io.to(`chat:${payload.chatId}`).emit('message:read', {
                                    chatId: payload.chatId,
                                    messageIds: [savedMessage._id.toString()]
                                });
                                console.log(`[Message Worker] Message marked as seen: ${savedMessage._id}`);
                            }
                        }
                    }
                    else {
                        // Receiver is online but not viewing this chat - send refresh notification
                        socket_1.io.to(receiverSocketId).emit('chat:refresh', {
                            chatId: payload.chatId,
                            message: savedMessage
                        });
                        console.log(`[Message Worker] Sent chat refresh notification to user: ${receiverId}`);
                    }
                }
                else {
                    // Receiver is offline - could send push notification here
                    console.log(`[Message Worker] Receiver ${receiverId} is offline - push notification could be sent here`);
                }
                channel.ack(msg);
            }
            catch (error) {
                console.error(`[Message Worker] Error processing message:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        }));
        connection.on('error', (err) => {
            console.error('[Message Worker] RabbitMQ connection error:', err);
        });
        connection.on('close', () => {
            console.log('[Message Worker] RabbitMQ connection closed');
        });
    }
    catch (error) {
        console.error('[Message Worker] Failed to start worker:', error);
        setTimeout(() => (0, exports.startMessageWorker)(), 5000);
    }
});
exports.startMessageWorker = startMessageWorker;

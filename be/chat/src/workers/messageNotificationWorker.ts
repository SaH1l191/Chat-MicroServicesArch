import amqp from 'amqplib';
import { userSocketMap, viewingChatMap, io } from '../socket/socket';
import { Message } from '../models/Message';
import dotenv from 'dotenv';
import { Chat } from '../models/Chat';
dotenv.config();

const QUEUE_NAME = 'chat:message:notification';

interface MessagePayload {
    chatId: string;
    senderId: string;
    text?: string;
    image?: {
        url: string;
        publicId: string;
    };
    messageType: 'text' | 'image';
    seen: boolean;
    seenAt?: Date;
}

export const startMessageNotificationWorker = async () => {
    try {
        const connectionUrl = process.env.Rabbitmq_URL || 'amqp://localhost:5672';
        const connection = await amqp.connect(connectionUrl);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });
        
        // Prefetch 1 message at a time
        channel.prefetch(1);

        console.log(`[Notification Worker] Waiting for messages in queue: ${QUEUE_NAME}`);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (!msg) return;

            try {
                const payload: MessagePayload = JSON.parse(msg.content.toString());
                
                console.log(`[Notification Worker] Processing notification for chat: ${payload.chatId}`);

                // Find the receiver (other user in the chat)
                // We need to get chat info to find the receiver
                const chat = await Chat.findById(payload.chatId);
                
                if (!chat) {
                    console.warn(`[Notification Worker] Chat not found: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }

                const receiverId = chat.users.find(
                    (userId) => userId.toString() !== payload.senderId.toString()
                )?.toString();

                if (!receiverId) {
                    console.warn(`[Notification Worker] No receiver found for chat: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }

                // Check if receiver is online
                const receiverSocketId = userSocketMap[receiverId];
                const isReceiverOnline = !!receiverSocketId;
                
                // Ensure both are strings for comparison
                const currentViewingChat = viewingChatMap[receiverId];
                const isReceiverViewingChat = currentViewingChat && 
                    currentViewingChat.toString() === payload.chatId.toString();

                if (isReceiverOnline) {
                    // If receiver is viewing THIS SPECIFIC chat, mark as seen immediately
                    if (isReceiverViewingChat) {
                        // Double-check: Verify they're actually in the chat room
                        const receiverSocket = io.sockets.sockets.get(receiverSocketId);
                        if (receiverSocket) {
                            const isInRoom = Array.from(receiverSocket.rooms).includes(`chat:${payload.chatId}`);
                            if (isInRoom) {
                                // Wait a bit for storage worker to save the message
                                await new Promise(resolve => setTimeout(resolve, 200));
                                
                                // Find the message and mark as seen
                                const messages = await Message.find({
                                    chatId: payload.chatId,
                                    sender: payload.senderId.toString()
                                }).sort({ createdAt: -1 }).limit(1);

                                if (messages.length > 0) {
                                    const message = messages[0];
                                    // Only mark as seen if it's not already seen
                                    if (!message.seen) {
                                        await Message.findByIdAndUpdate(message._id, {
                                            seen: true,
                                            seenAt: new Date()
                                        });

                                        io.to(`chat:${payload.chatId}`).emit('message:read', {
                                            chatId: payload.chatId,
                                            messageIds: [message._id.toString()]
                                        });

                                        console.log(`[Notification Worker] Message marked as seen: ${message._id}`);
                                    }
                                }
                            }
                        }
                    } else {
                        // Receiver is online but not viewing this chat - send refresh notification
                        io.to(receiverSocketId).emit('chat:refresh', {
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
                } else {
                    // Receiver is offline - could send push notification here
                    // For now, just log it
                    console.log(`[Notification Worker] Receiver ${receiverId} is offline - push notification could be sent here`);
                    // TODO: Integrate with push notification service (FCM, APNS, etc.)
                }

                // Acknowledge message processing
                channel.ack(msg);
            } catch (error) {
                console.error(`[Notification Worker] Error processing notification:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        });

        // Handle connection errors
        connection.on('error', (err) => {
            console.error('[Notification Worker] RabbitMQ connection error:', err);
        });

        connection.on('close', () => {
            console.log('[Notification Worker] RabbitMQ connection closed');
        });

    } catch (error) {
        console.error('[Notification Worker] Failed to start worker:', error);
        // Retry after 5 seconds
        setTimeout(() => startMessageNotificationWorker(), 5000);
    }
};


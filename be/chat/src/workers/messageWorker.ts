import amqp from 'amqplib';
import { userSocketMap, viewingChatMap, io } from '../socket/socket';
import { Message } from '../models/Message';
import { Chat } from '../models/Chat';
import dotenv from 'dotenv';

dotenv.config();

const QUEUE_NAME = 'chat:messages';

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

/** 
 * Handles: Storage -> Delivery -> Notifications in sequence 
 */
export const startMessageWorker = async () => {
    try {
        const connectionUrl = process.env.Rabbitmq_URL!;
        const connection = await amqp.connect(connectionUrl);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });
         
        channel.prefetch(1);
        console.log(`[Message Worker] Waiting for messages in queue: ${QUEUE_NAME}`);
        channel.consume(QUEUE_NAME, async (msg) => {
            if (!msg) return;
            try {
                const payload: MessagePayload = JSON.parse(msg.content.toString());
                console.log(`[Message Worker] Processing message for chat: ${payload.chatId}`);

                // Step 1: Save message to database
                const messageData: any = {
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
                const message = new Message(messageData);
                const savedMessage = await message.save();

                
                const latestMessageText = payload.image ? "📷 Image" : (payload.text || "");
                await Chat.findByIdAndUpdate(payload.chatId, {
                    latestMessage: {
                        text: latestMessageText,
                        sender: payload.senderId,
                    },
                    updatedAt: new Date()
                }, { new: true });

                console.log(`[Message Worker] Message saved: ${savedMessage._id}`);

                // Step 2: Deliver message via WebSocket
                const messageToSend = {
                    ...savedMessage.toObject(),
                    createdAt: savedMessage.createdAt ? new Date(savedMessage.createdAt).toISOString() : new Date().toISOString()
                };
                
                io.to(`chat:${payload.chatId}`).emit('message:new', {
                    message: messageToSend,
                    chatId: payload.chatId,
                    senderId: payload.senderId
                });
                console.log(`[Message Worker] Message delivered via WebSocket`);

                // Step 3: Handle notifications and read receipts
                const chat = await Chat.findById(payload.chatId);
                if (!chat) {
                    console.warn(`[Message Worker] Chat not found: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }

                const receiverId = chat.users.find(
                    (userId) => userId.toString() !== payload.senderId.toString()
                )?.toString();

                if (!receiverId) {
                    console.warn(`[Message Worker] No receiver found for chat: ${payload.chatId}`);
                    channel.ack(msg);
                    return;
                }

                const receiverSocketId = userSocketMap[receiverId];
                const isReceiverOnline = !!receiverSocketId;
                const currentViewingChat = viewingChatMap[receiverId];
                const isReceiverViewingChat = currentViewingChat && 
                    currentViewingChat.toString() === payload.chatId.toString();

                if (isReceiverOnline) {
                    // If receiver is viewing THIS chat, mark as seen immediately
                    if (isReceiverViewingChat) {
                        const receiverSocket = io.sockets.sockets.get(receiverSocketId);
                        if (receiverSocket) {
                            const isInRoom = Array.from(receiverSocket.rooms).includes(`chat:${payload.chatId}`);
                            if (isInRoom && !savedMessage.seen) {
                                await Message.findByIdAndUpdate(savedMessage._id, {
                                    seen: true,
                                    seenAt: new Date()
                                });

                                io.to(`chat:${payload.chatId}`).emit('message:read', {
                                    chatId: payload.chatId,
                                    messageIds: [savedMessage._id.toString()]
                                });

                                console.log(`[Message Worker] Message marked as seen: ${savedMessage._id}`);
                            }
                        }
                    } else {
                        // Receiver is online but not viewing this chat - send refresh notification
                        io.to(receiverSocketId).emit('chat:refresh', {
                            chatId: payload.chatId,
                            message: savedMessage
                        });
                        console.log(`[Message Worker] Sent chat refresh notification to user: ${receiverId}`);
                    }
                } else {
                    // Receiver is offline - could send push notification here
                    console.log(`[Message Worker] Receiver ${receiverId} is offline - push notification could be sent here`);
                }
                channel.ack(msg);
            } catch (error) {
                console.error(`[Message Worker] Error processing message:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        });

      
        connection.on('error', (err) => {
            console.error('[Message Worker] RabbitMQ connection error:', err);
        });

        connection.on('close', () => {
            console.log('[Message Worker] RabbitMQ connection closed');
        });

    } catch (error) {
        console.error('[Message Worker] Failed to start worker:', error);
    
        setTimeout(() => startMessageWorker(), 5000);
    }
};


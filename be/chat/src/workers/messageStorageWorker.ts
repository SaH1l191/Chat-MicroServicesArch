import amqp from 'amqplib';
import { Message } from '../models/Message';
import { Chat } from '../models/Chat';
import dotenv from 'dotenv';

dotenv.config();

const QUEUE_NAME = 'chat:message:storage';

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

export const startMessageStorageWorker = async () => {
    try {
        const connectionUrl = process.env.Rabbitmq_URL || 'amqp://localhost:5672';
        const connection = await amqp.connect(connectionUrl);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });
        
        // Prefetch 1 message at a time for better load distribution
        channel.prefetch(1);

        console.log(`[Storage Worker] Waiting for messages in queue: ${QUEUE_NAME}`);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (!msg) return;

            try {
                const payload: MessagePayload = JSON.parse(msg.content.toString());
                
                console.log(`[Storage Worker] Processing message for chat: ${payload.chatId}`);

                // Save message to database
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

                // Update chat's latest message
                const latestMessageText = payload.image ? "📷 Image" : (payload.text || "");
                await Chat.findByIdAndUpdate(payload.chatId, {
                    latestMessage: {
                        text: latestMessageText,
                        sender: payload.senderId,
                    },
                    updatedAt: new Date()
                }, { new: true });

                console.log(`[Storage Worker] Message saved with ID: ${savedMessage._id}`);

                // Acknowledge message processing
                channel.ack(msg);
            } catch (error) {
                console.error(`[Storage Worker] Error processing message:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        });

        // Handle connection errors
        connection.on('error', (err) => {
            console.error('[Storage Worker] RabbitMQ connection error:', err);
        });

        connection.on('close', () => {
            console.log('[Storage Worker] RabbitMQ connection closed');
        });

    } catch (error) {
        console.error('[Storage Worker] Failed to start worker:', error);
        // Retry after 5 seconds
        setTimeout(() => startMessageStorageWorker(), 5000);
    }
};


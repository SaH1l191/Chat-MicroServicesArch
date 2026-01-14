import amqp from 'amqplib';
import { io } from '../socket/socket';
import { Message } from '../models/Message';
import dotenv from 'dotenv';

dotenv.config();

const QUEUE_NAME = 'chat:message:delivery';

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

export const startMessageDeliveryWorker = async () => {
    try {
        const connectionUrl = process.env.Rabbitmq_URL || 'amqp://localhost:5672';
        const connection = await amqp.connect(connectionUrl);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });
        
        // Prefetch 1 message at a time
        channel.prefetch(1);

        console.log(`[Delivery Worker] Waiting for messages in queue: ${QUEUE_NAME}`);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (!msg) return;

            try {
                const payload: MessagePayload = JSON.parse(msg.content.toString());
                
                console.log(`[Delivery Worker] Delivering message for chat: ${payload.chatId}`);

                // Fetch the saved message from DB (storage worker should have saved it by now)
                // We'll retry a few times in case storage worker hasn't finished yet
                let savedMessage = null;
                let retries = 3;
                
                while (retries > 0 && !savedMessage) {
                    // Find the most recent message for this chat from this sender
                    const messages = await Message.find({
                        chatId: payload.chatId,
                        sender: payload.senderId
                    }).sort({ createdAt: -1 }).limit(1);
                    
                    if (messages.length > 0) {
                        // Check if it matches our payload (by checking text/image and timestamp)
                        const candidate = messages[0];
                        const matches = 
                            (payload.text && candidate.text === payload.text) ||
                            (payload.image && candidate.image?.publicId === payload.image.publicId);
                        
                        if (matches) {
                            savedMessage = candidate;
                            break;
                        }
                    }
                    
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 100));
                    retries--;
                }

                if (savedMessage) {
                    // Deliver message via WebSocket
                    io.to(`chat:${payload.chatId}`).emit('message:new', {
                        message: savedMessage,
                        chatId: payload.chatId,
                        senderId: payload.senderId
                    });

                    console.log(`[Delivery Worker] Message delivered via WebSocket: ${savedMessage._id}`);
                } else {
                    console.warn(`[Delivery Worker] Could not find saved message for chat: ${payload.chatId}`);
                }

                // Acknowledge message processing
                channel.ack(msg);
            } catch (error) {
                console.error(`[Delivery Worker] Error delivering message:`, error);
                // Reject message and requeue it
                channel.nack(msg, false, true);
            }
        });

        // Handle connection errors
        connection.on('error', (err) => {
            console.error('[Delivery Worker] RabbitMQ connection error:', err);
        });

        connection.on('close', () => {
            console.log('[Delivery Worker] RabbitMQ connection closed');
        });

    } catch (error) {
        console.error('[Delivery Worker] Failed to start worker:', error);
        // Retry after 5 seconds
        setTimeout(() => startMessageDeliveryWorker(), 5000);
    }
};


import amqp from 'amqplib';

let channel: amqp.Channel | null = null;
let connection: any = null;

const QUEUE_NAME = 'chat:messages';

export const connectRabbitMq = async () => {
    try {
        const connectionUrl = process.env.Rabbitmq_URL!;
        connection = await amqp.connect(connectionUrl);
        channel = await connection.createChannel();
        console.log("Connected to RabbitMQ");
        
        // Simple single queue - no exchange needed
        if (channel) {
            await channel.assertQueue(QUEUE_NAME, { durable: true });
        }
        
        return channel;
    } catch (error) {
        console.log("Error in connecting to RabbitMQ:", error);
        throw error;
    }
};

export const publishToQueue = async (message: any) => {
    if (!channel) {
        console.log("RabbitMQ channel is not initialized");
        return;
    }

    // Simple direct queue publish
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true, // Message saved to disk
    });
    
    console.log(`Message published to queue: ${QUEUE_NAME}`);
};

export const getChannel = () => {
    return channel;
};

export const getQueueName = () => {
    return QUEUE_NAME;
};

export const closeConnection = async () => {
    if (channel) {
        await channel.close();
    }
    if (connection) {
        await connection.close();
    }
};

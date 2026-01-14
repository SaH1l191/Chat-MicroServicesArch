import amqp from 'amqplib';

let channel: amqp.Channel | null = null;
let connection: amqp.Connection | null = null;

const EXCHANGE_NAME = 'chat:messages';
const QUEUE_NAMES = {
    STORAGE: 'chat:message:storage',
    DELIVERY: 'chat:message:delivery',
    NOTIFICATION: 'chat:message:notification'
};

export const connectRabbitMq = async () => {
    try {
        const connectionUrl = process.env.Rabbitmq_URL! ;
        const connection = await amqp.connect(connectionUrl);
        channel = await connection.createChannel();
        console.log("Connected to RabbitMQ");
        
         
        await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: true });
        
         
        await channel.assertQueue(QUEUE_NAMES.STORAGE, { durable: true });
        await channel.assertQueue(QUEUE_NAMES.DELIVERY, { durable: true });
        await channel.assertQueue(QUEUE_NAMES.NOTIFICATION, { durable: true });
        
        // Bind queues to exchange
        await channel.bindQueue(QUEUE_NAMES.STORAGE, EXCHANGE_NAME, '');
        await channel.bindQueue(QUEUE_NAMES.DELIVERY, EXCHANGE_NAME, '');
        await channel.bindQueue(QUEUE_NAMES.NOTIFICATION, EXCHANGE_NAME, '');
        
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

    // Publish to exchange, which will fan out to all queues
    channel.publish(EXCHANGE_NAME, '', Buffer.from(JSON.stringify(message)), {
        persistent: true, // Message saved to disk
    });
    
    console.log(`Message published to exchange: ${EXCHANGE_NAME}`);
};

export const getChannel = () => {
    return channel;
};

export const getQueueNames = () => {
    return QUEUE_NAMES;
};

export const closeConnection = async () => {
    if (channel) {
        await channel.close();
    }
    if (connection) {
        await connection.close();
    }
};


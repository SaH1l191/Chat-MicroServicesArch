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
exports.closeConnection = exports.getQueueName = exports.getChannel = exports.publishToQueue = exports.connectRabbitMq = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
let channel = null;
let connection = null;
const QUEUE_NAME = 'chat:messages';
const connectRabbitMq = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connectionUrl = process.env.Rabbitmq_URL;
        connection = yield amqplib_1.default.connect(connectionUrl);
        channel = yield connection.createChannel();
        console.log("Connected to RabbitMQ");
        // Simple single queue - no exchange needed
        if (channel) {
            yield channel.assertQueue(QUEUE_NAME, { durable: true });
        }
        return channel;
    }
    catch (error) {
        console.log("Error in connecting to RabbitMQ:", error);
        throw error;
    }
});
exports.connectRabbitMq = connectRabbitMq;
const publishToQueue = (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (!channel) {
        console.log("RabbitMQ channel is not initialized");
        return;
    }
    // Simple direct queue publish
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true, // Message saved to disk
    });
    console.log(`Message published to queue: ${QUEUE_NAME}`);
});
exports.publishToQueue = publishToQueue;
const getChannel = () => {
    return channel;
};
exports.getChannel = getChannel;
const getQueueName = () => {
    return QUEUE_NAME;
};
exports.getQueueName = getQueueName;
const closeConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    if (channel) {
        yield channel.close();
    }
    if (connection) {
        yield connection.close();
    }
});
exports.closeConnection = closeConnection;

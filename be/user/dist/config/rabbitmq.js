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
exports.publishToQueue = exports.connectRabbitMq = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
let channel;
// virtual connection.
//one tcp connection 
// rabbitmq work happens throgu channel 
const connectRabbitMq = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connection = yield amqplib_1.default.connect({
            protocol: "amqp",
            hostname: process.env.Rabbitmq_Host,
            port: 5672,
            username: process.env.Rabbitmq_Username,
            password: process.env.Rabbitmq_Password
        });
        channel = yield connection.createChannel();
        console.log("Connected to RabbitMQ");
    }
    catch (error) {
        console.log("error in conncecting to rabbitmq", error);
    }
});
exports.connectRabbitMq = connectRabbitMq;
const publishToQueue = (queueName, message) => __awaiter(void 0, void 0, void 0, function* () {
    if (!channel) {
        console.log("RabbitMq is not initialized");
        return;
    }
    //make sure a queue named send-otp exists.”
    // If it exists → nothing happens
    // If it does NOT exist → RabbitMQ creates it
    // It does NOT send messages
    // It does NOT consume messages
    yield channel.assertQueue(queueName, { durable: true }); //survives RabbitMQ restart
    //Writes message metadata to disk
    // May keep a copy in RAM for speed
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true, //message saved to disk
    });
});
exports.publishToQueue = publishToQueue;

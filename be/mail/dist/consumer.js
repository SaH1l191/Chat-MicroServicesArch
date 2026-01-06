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
exports.sendOtpConsumer = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const dotenv_1 = __importDefault(require("dotenv"));
const mailConfig_1 = __importDefault(require("./config/mailConfig"));
dotenv_1.default.config();
const sendOtpConsumer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // const connection = await ampq.connect({
        //     protocol: "amqp",
        //     hostname: process.env.Rabbitmq_Host!,
        //     port: 5672,
        //     username: process.env.Rabbitmq_Username!,
        //     password: process.env.Rabbitmq_Password!
        // })
        const connection = yield amqplib_1.default.connect(process.env.Rabbitmq_URL);
        const channel = yield connection.createChannel();
        yield channel.assertQueue("send-otp", { durable: true });
        console.log("Mail service consumer started!");
        //listening mode : no polling 
        channel.consume("send-otp", (message) => __awaiter(void 0, void 0, void 0, function* () {
            if (message) {
                try {
                    const { to, subject, body } = JSON.parse(message.content.toString());
                    yield mailConfig_1.default.sendMail({
                        from: process.env.MAIL_USER,
                        to: to,
                        subject: subject,
                        html: body
                    });
                    channel.ack(message);
                    console.log("Message sent by Message Consumer!");
                }
                catch (error) {
                    console.log("Failed to send OTP ", error);
                    channel.nack(message, false, true);
                }
            }
        }));
    }
    catch (error) {
        console.log("Failed to start rabbitMq server", error);
    }
});
exports.sendOtpConsumer = sendOtpConsumer;

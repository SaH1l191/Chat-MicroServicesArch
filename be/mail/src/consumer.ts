import ampq from 'amqplib';
import dotenv from "dotenv"
import transporter from './config/mailConfig';
dotenv.config()

export const sendOtpConsumer = async () => {
    try {
        // const connection = await ampq.connect({
        //     protocol: "amqp",
        //     hostname: process.env.Rabbitmq_Host!,
        //     port: 5672,
        //     username: process.env.Rabbitmq_Username!,
        //     password: process.env.Rabbitmq_Password!
        // })
        const connection = await ampq.connect(process.env.Rabbitmq_URL!);
        const channel = await connection.createChannel()
        await channel.assertQueue("send-otp", { durable: true })
        console.log("Mail service consumer started!")


        //listening mode : no polling 
        channel.consume("send-otp", async (message) => {
            if (message) {
                try {
                    const { to, subject, body } = JSON.parse(message.content.toString())

                    await transporter.sendMail({
                        from: process.env.MAIL_USER!,
                        to: to,
                        subject: subject,
                        html: body
                    })
                    channel.ack(message);
                    console.log("Message sent by Message Consumer!")
                } catch (error) {
                    console.log("Failed to send OTP ", error)
                    channel.nack(message, false, true);
                }
            }
        })
    }
    catch (error) {
        console.log("Failed to start rabbitMq server", error)
    }
}
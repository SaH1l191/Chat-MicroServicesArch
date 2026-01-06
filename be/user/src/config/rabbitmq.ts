import ampq from 'amqplib';

let channel: ampq.Channel;
// virtual connection.
//one tcp connection 
// rabbitmq work happens throgu channel 
// export const connectRabbitMq = async () => {
//     try {
//         const connection = await ampq.connect({
//             protocol: "amqp",
//             hostname: process.env.Rabbitmq_Host,
//             port: 5672,
//             username: process.env.Rabbitmq_Username,
//             password: process.env.Rabbitmq_Password
//         })
//         channel = await connection.createChannel()
//         console.log("Connected to RabbitMQ")
//     } catch (error) {
//         console.log("error in conncecting to rabbitmq", error)
//     }
// }
export const connectRabbitMq = async () => {
    try {
        // Example: amqps://username:password@hostname/vhost
        const connection = await ampq.connect(process.env.Rabbitmq_URL!);
        channel = await connection.createChannel();
        console.log("Connected to RabbitMQ");
    } catch (error) {
        console.log("Error in connecting to RabbitMQ:", error);
    }
};
export const publishToQueue = async (queueName: string, message: any) => {
    if (!channel) {
        console.log("RabbitMq is not initialized")
        return;
    }

    //make sure a queue named send-otp exists.”

    // If it exists → nothing happens
    // If it does NOT exist → RabbitMQ creates it
    // It does NOT send messages
    // It does NOT consume messages
    await channel.assertQueue(queueName, { durable: true }) //survives RabbitMQ restart
    //Writes message metadata to disk
    // May keep a copy in RAM for speed


    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true, //message saved to disk
    })
}
import express from 'express'
import dotenv from 'dotenv'
import connectDb from './config/db'
import { createClient } from 'redis'
import { connectRabbitMq } from './config/rabbitmq'
import userRoutes from './routes/user'
import cors from 'cors'
import cookieParser from 'cookie-parser'
dotenv.config()

const app = express()
app.use(express.json()) 
app.use(cookieParser());
app.use("/api/v1", userRoutes)

connectDb()
connectRabbitMq()

export const redisClient = createClient({
    url: process.env.REDIS_URL!
})
redisClient.connect()
    .then(() => console.log("Redis connected"))
    .catch((err) => console.error("Redis connection error", err))

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`User service listening at port ${PORT}`)
})   
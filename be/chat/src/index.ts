import express from 'express'
import dotenv from 'dotenv'
import connectDb from './config/db'
import chatRoutes from './routes/route'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { app, server } from './socket/socket'
dotenv.config()



//mounting everything on app except need to listen on server 
// because app used for routing , socket used for websockets 
app.use(cors({
  origin: process.env.CODEBASE === "production" ? process.env.FRONTEND_URL : 'http://localhost:3003',
  credentials: true, // Important for httpOnly cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())
app.use(cookieParser())
app.use('/api/v1', chatRoutes)
connectDb()

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat service listening at port ${PORT}`)
})     


app.get('/', (req, res) => {
    res.send('Chat Service is running')
})

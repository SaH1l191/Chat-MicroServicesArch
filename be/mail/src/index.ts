



// MAIL INDEX.ts


import express from 'express'
import dotenv from 'dotenv'  
import { sendOtpConsumer } from './consumer'
import cors from 'cors'

dotenv.config() 
sendOtpConsumer()
const app = express()

app.use(cors({
    origin: process.env.CODEBASE === "production" ? process.env.FRONTEND_URL : 'http://localhost:3003', // Next.js default port
    credentials: true, // Important for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Mail service listening at port ${PORT}`)
})      

app.get('/', (req, res) => {
    res.send('Mail Service is running')
})

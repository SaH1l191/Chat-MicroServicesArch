



// MAIL INDEX.ts


import express from 'express'
import dotenv from 'dotenv'  
import { sendOtpConsumer } from './consumer'
 

dotenv.config() 
sendOtpConsumer()
const app = express()
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Mail service listening at port ${PORT}`)
})      
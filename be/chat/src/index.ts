import express from 'express'
import dotenv from 'dotenv' 
import connectDb from './config/db'
import chatRoutes from './routes/route'
import cookieParser from 'cookie-parser'
dotenv.config()

 


const app = express()
app.use(express.json())   
app.use(cookieParser())
app.use('/api/v1',chatRoutes)
connectDb()
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Chat service listening at port ${PORT}`)
})     
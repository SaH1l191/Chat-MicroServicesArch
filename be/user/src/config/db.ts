import mongoose from "mongoose"
import dotenv from 'dotenv'


dotenv.config()

const connectDb = async () => {
    const dbUrl = process.env.DB_URI
    if (!dbUrl) throw new Error("No DB URL")

    try {
        await mongoose.connect(dbUrl)
        console.log("connected to MongoDB")
    }
    catch (error) {
        console.log("Error connecting to database :", error)
    }
}
export default connectDb
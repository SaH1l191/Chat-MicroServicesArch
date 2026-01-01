import mongoose from "mongoose";
import { Types } from "mongoose";

export interface IChat {
    users: string[];
    latestMessage: {
        text: string,
        sender: string
    }
    createdAt?: Date;
    updatedAt?: Date;
    _id: Types.ObjectId;
}

const chatSchema = new mongoose.Schema({
    users: [
        {
            type: String,
            required: true
        }
    ],
    latestMessage: {
        text: String,
        sender: String,
    }
}, {
    timestamps: true
})
export const Chat = mongoose.model("Chat", chatSchema)
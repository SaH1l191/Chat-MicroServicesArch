import mongoose  from "mongoose";
import { Types } from "mongoose";

export interface IUser {
    name: string;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;
    _id : Types.ObjectId;

}

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    }, 
}, {
    timestamps: true
})
export const User =mongoose.model("User", userSchema)
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Chat } from "../models/Chat";
import {  Message } from "../models/Message";
import axios from "axios";
import dotenv from 'dotenv'
dotenv.config()

export const createNewChat = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { otherUserId } = req.body;
        // 2:21:51//
        if (!otherUserId) {
            return res.status(400).json({ message: "Other user ID is required" })
        }
        const existingChat = await Chat.findOne({
            users: { $all: [userId, otherUserId], $size: 2 }
        })
        if (existingChat) {
            return res.json({
                messaeg: "Chat already exists",
                chatId: existingChat._id
            })
        }
        const newChat = await Chat.create({
            users: [userId, otherUserId]
        })
        return res.status(200).json({
            message: "New Chat Created",
            chatId: newChat._id
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Error" })
    }
}


export const getAllChats = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" })
        }
        const chats = await Chat.find({ users: userId }).sort({ updated: -1 })

        //Promise.all ensures:
        // parallel DB + HTTP calls
        // faster response time than sequential await
        console.log("Chats : ",chats)
        const chatWithUserData = await Promise.all(
            chats.map(async (chat) => {
                const otherUserId = chat.users.find((id) => id !== userId)

                const unseenCount = await Message.countDocuments({
                    chatId: chat._id,
                    sender: { $ne: userId },
                    seen: false
                })
                try {
                    const { data } = await axios.get(`${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`)
                    console.log(`api to : ${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`)
                    console.log("Data from user service ", data)
                    return {
                        user: data,
                        chat: {
                            ...chat.toObject(),
                            latestMessage: chat.latestMessage || null,
                            unseenCount
                        }
                    }
                }
                catch (error) {
                    //fallback if user service fails 
                    console.log("error ", error);
                    return {
                        uesr: {
                            _id: otherUserId, name: "Unknown User"
                        },
                        chat: {
                            ...chat.toObject(),
                            latestMessage: chat.latestMessage || null,
                            unseenCount
                        }
                    }
                }
            })
        )
        console.log("chatWithUserData : ",chatWithUserData)
        return res.json({
            chats: chatWithUserData
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Error in getting chats" })
    }
}

export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const senderId = req?.user?._id;
        const { chatId, text } = req.body;
        const imageFile = req.file

        if (!senderId) {
            return res.status(400).json({ message: "Sender ID is required" })
        }
        if (!chatId) {
            return res.status(400).json({ message: "Chat ID is required" })
        }
        if (!text && !imageFile) {
            return res.status(400).json({ message: "Message or image is required" })
        }
        const chat = await Chat.findById(chatId)
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" })
        }
        const isUserInChat = chat.users.some((userId) => userId.toString() === senderId.toString())
        if (!isUserInChat) {
            return res.status(403).json({ message: "You are not a part of this chat" })
        }

        const otherUserId = chat.users.find((userId) => userId.toString() !== senderId.toString())
        if (!otherUserId) {
            return res.status(403).json({ message: "No other user found in this chat" })
        }
        //socket here 
        let messageData: any
        messageData = {
            chatId: chatId,
            sender: senderId,
            seen: false,
            seenAt: undefined
        }
        if (imageFile) {
            messageData.image = {
                url: imageFile.path,
                publicId: imageFile.filename
            }
            messageData.messageType = "image"
            messageData.text = text || ""
        } else {
            messageData.text = text;
            messageData.messageType = "text"
            messageData.image = undefined
        }
        const message = new Message(messageData)
        const savedMessage = await message.save()
        const latestMessageText = imageFile ? "📷 Image" : text
        await Chat.findByIdAndUpdate(chatId, {
            latestMessage: {
                text: latestMessageText,
                senderId: senderId,
            },
            updatedAt: new Date()
        }, { new: true })


        return res.status(201).json({
            message: savedMessage,
            sender: senderId
        })
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Error in sending message" })
    }
}


export const getMessageByChat = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id
        const { chatId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" })
        }
        const chat = await Chat.findById(chatId)
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" })
        }
        const isUserInChat = chat.users.some((id) => id.toString() === userId.toString())
        if (!isUserInChat) {
            return res.status(403).json({ message: "You are not a part of this chat" })
        }

        //when user clicks the chats, all the unseen messsages
        const messagesToMarkSeen = await Message.find({
            chatId,
            sender: { $ne: userId },
            seen: false
        })
        //mark them seen 
        //read receipt feature
        await Message.updateMany({
            chatId: chatId,
            sender: { $ne: userId },
            seen: false
        }, {
            seen: true,
            seenAt: new Date()
        })

        //ascending order 
        const messages = await Message.find({ chatId }).sort({ createdAt: 1 })
        const otherUserId = chat.users.find((id) => id !== userId)
        console.log("Other Used Id ", otherUserId)
        try {
            const { data } = await axios.get(`${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`)
            console.log("Data from user Serivce for other user ", data )
            if (!otherUserId) {
                return res.status(404).json({ message: "No Other User" })
            }
            return res.status(200).json({
                messages,
                user: data
            })
        }
        catch (error) {
            return res.json({ messages, user: { _id: otherUserId, name: "Unknown User" } })
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Error in getting messages" })

    }
} 
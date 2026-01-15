import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Chat } from "../models/Chat";
import { Message } from "../models/Message";
import axios from "axios";
import dotenv from 'dotenv'
import { io, userSocketMap, viewingChatMap } from "../socket/socket";
import { publishToQueue } from "../config/rabbitmq";
dotenv.config()

export const createNewChat = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { otherUserId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" })
        }
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

        const otherUserSocketId = userSocketMap[otherUserId.toString()]
        if (otherUserSocketId) {
            io.to(otherUserSocketId).emit('chat:new', {
                chatId: newChat._id.toString(),
                createdBy: userId.toString()
            })
        }

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
        // console.log("Chats : ",chats)
        const chatWithUserData = await Promise.all(
            chats.map(async (chat) => {
                const otherUserId = chat.users.find(
                    (id) => id.toString() !== userId.toString()
                )
                const unseenCount = await Message.countDocuments({
                    chatId: chat._id,
                    sender: { $ne: userId },
                    seen: false
                })
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_CODEBASE === "production" ? process.env.NEXT_USER_SERVICE_APP_URL : "http://localhost:3000"
                    const { data } = await axios.get(`${baseUrl}/api/v1/user/${otherUserId}`)
                    // console.log(`api to : ${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`)
                    // console.log("Data from user service ", data)
                    // Extract user from response - user service returns { user: {...} }
                    const userData = data.user || data
                    return {
                        user: userData,
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
                        user: {
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

        // no empty chats 
        const filteredChats = chatWithUserData.filter((chat) => chat !== null)

        // console.log("chatWithUserData : ",filteredChats)
        return res.json({
            chats: filteredChats
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

        // Prepare message payload for worker
        let messagePayload: any = {
            chatId: chatId,
            senderId: senderId.toString(),
            seen: false,
            seenAt: undefined
        }

        if (imageFile) {
            messagePayload.image = {
                url: imageFile.path,
                publicId: imageFile.filename
            }
            messagePayload.messageType = "image"
            messagePayload.text = text || ""
        } else {
            messagePayload.text = text;
            messagePayload.messageType = "text"
        }

        // Publish to queue - worker will handle everything
        await publishToQueue(messagePayload);

        // Return immediately - worker handles storage, delivery, and notifications
        // Fetch current messages for response
        const messages = await Message.find({ chatId }).sort({ createdAt: 1 })
        const updatedChat = await Chat.findById(chatId)

        return res.status(201).json({
            message: {
                chatId,
                sender: senderId,
                text: messagePayload.text,
                image: messagePayload.image,
                messageType: messagePayload.messageType,
                seen: false
            },
            messages,
            chat: updatedChat,
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
        const otherUserId = chat.users.find((id) => id.toString() !== userId.toString())
        console.log("Other Used Id ", otherUserId)

        if (!otherUserId) {
            return res.status(404).json({ message: "No Other User" })
        }

        try {
            const baseUrl = process.env.NEXT_PUBLIC_CODEBASE === "production" ? process.env.NEXT_USER_SERVICE_APP_URL : "http://localhost:3000"
            const { data } = await axios.get(`${baseUrl}/api/v1/user/${otherUserId}`) 
            const userData = data.user || data
            return res.status(200).json({
                messages,
                user: userData
            })
        }
        catch (error) {
            return res.status(200).json({ messages, user: { _id: otherUserId, name: "Unknown User" } })
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Error in getting messages" })

    }
} 
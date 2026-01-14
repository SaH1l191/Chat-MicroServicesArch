import express from 'express'
import http from 'http'
import { Server, Socket } from 'socket.io'
const app = express()
const server = http.createServer(app)
import { Message } from '../models/Message'


const io = new Server(server, {
    cors: {
        origin: process.env.CODEBASE === "production" ? process.env.FRONTEND_URL : 'http://localhost:3003',
        credentials: true,
        methods: ['GET', 'POST']
    }
})
export const userSocketMap: Record<string, string> = {}  // userID : socketId
export const viewingChatMap: Record<string, string> = {} // userID : chatId (user watching which chatId)


io.on('connection', (socket: Socket) => {
    console.log('a user connected', socket.id)
    const userId = socket.handshake.query.userId as string | undefined
    if (userId && userId !== null) {
        userSocketMap[userId] = socket.id
        console.log(`User ${userId} is connected with socket id ${socket.id}`)
    }

    io.emit('getOnlineUsers', Object.keys(userSocketMap))

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id)

        for (const userId in userSocketMap) {
            if (userSocketMap[userId] === socket.id) {
                console.log("User disconnected", userId, "with socket id ", socket.id)
                delete userSocketMap[userId]
                delete viewingChatMap[userId]
                io.emit('getOnlineUsers', Object.keys(userSocketMap))
                break
            }
        }
    })

    socket.on('connect-error', (error: Error) => {
        console.log('Connect error', error)
    })


    socket.on('join:chat', (chatId: string) => {
        socket.join(`chat:${chatId}`)
        const userId = socket.handshake.query.userId as string
        console.log(`User ${userId} joined chat room: chat:${chatId}`) 
        socket.to(`chat:${chatId}`).emit('user:joined:room', { chatId, userId })
    })

    socket.on('leave:chat', (chatId: string) => {
        socket.leave(`chat:${chatId}`)
        const userId = socket.handshake.query.userId as string
        console.log(`User ${userId} left chat room: chat:${chatId}`)
    })

    socket.on('viewing:chat', (chatId: string) => {
        const userId = socket.handshake.query.userId as string
        if (userId) {
            viewingChatMap[userId] = chatId
            console.log(`User ${userId} is now viewing chat: ${chatId}`)
        }
    })

    socket.on('not:viewing:chat', () => {
        const userId = socket.handshake.query.userId as string
        if (userId) {
            delete viewingChatMap[userId]
            console.log(`User ${userId} stopped viewing chat`)
        }
    })

    socket.on('typing:start', (data: { chatId: string; userId: string }) => {
        const { chatId, userId } = data
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: true })
    })

    socket.on('typing:stop', (data: { chatId: string; userId: string }) => {
        const { chatId, userId } = data
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: false })
    })

    socket.on('message:sent', (data: { chatId: string; message: any; senderId: string }) => {
        const { chatId, message, senderId } = data

        io.to(`chat:${chatId}`).emit('message:new', { message, chatId, senderId })
    })

    socket.on('message:read', async (data: { chatId: string; messageIds: string[] }) => {
        const { chatId, messageIds } = data
        const userId = socket.handshake.query.userId as string

        if (!userId) return
        await Message.updateMany(
            { _id: { $in: messageIds }, chatId },
            { seen: true, seenAt: new Date() }
        )
        socket.to(`chat:${chatId}`).emit('message:read', { chatId, messageIds })
    })
})


export { app, server, io }
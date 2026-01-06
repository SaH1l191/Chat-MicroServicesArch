import express from 'express'
import http from 'http'
import { Server, Socket } from 'socket.io'
const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: process.env.CODEBASE === "production" ? process.env.FRONTEND_URL : 'http://localhost:3003', // Next.js default port
        credentials: true,
        methods: ['GET', 'POST']
    }
})
const userSocketMap: Record<string, string> = {}


// socket refers to current client 
io.on('connection', (socket: Socket) => {
    console.log("socket Objc", socket)
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
        console.log(`User ${userId} joined chat room: chat:${chatId}`)
    })

    
    socket.on('leave:chat', (chatId: string) => {
        socket.leave(`chat:${chatId}`)
        console.log(`User ${userId} left chat room: chat:${chatId}`)
    })
 
    socket.on('typing:start', (data: { chatId: string; userId: string }) => {
        const { chatId, userId } = data
        // Emit to all users in this chat room except the sender
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: true })
    })

    socket.on('typing:stop', (data: { chatId: string; userId: string }) => {
        const { chatId, userId } = data
        // Notify room that user stopped typing (do not leave the room)
        socket.to(`chat:${chatId}`).emit('typing:status', { chatId, userId, isTyping: false })
    })
})


export { app, server, io }
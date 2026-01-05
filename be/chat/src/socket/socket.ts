import express from 'express'
import http from 'http'
import { Server, Socket } from 'socket.io'
const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3003',
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
})


export { app, server, io }
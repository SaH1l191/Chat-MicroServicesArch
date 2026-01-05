"use client"

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react"
import { io, Socket } from "socket.io-client"
import { useUser } from "@/lib/queries/user"

type SocketContextProps = {
    socket: Socket | null
    onlineUsers: string[]
}

const SocketContext = createContext<SocketContextProps>({
    socket: null,
    onlineUsers: []
})

export const useSocket = () => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider")
    }
    return context
}

export function SocketProvider({ children }: { children: ReactNode }) {
    const socketRef = useRef<Socket | null>(null)
    const { data: user } = useUser()
    const [onlineUsers, setOnlineUsers] = useState<string[]>([])

    useEffect(() => {
        // Only connect if user is authenticated
        if (!user?._id) {
            return
        }
        const socketUrl =
            process.env.NEXT_PUBLIC_CHAT_API_URL ||
            "http://localhost:3002"

        // Create socket connection
        const socket = io(socketUrl, {
            withCredentials: true,
            // transports: ["websocket", "polling"],
            // reconnection: true,
            // reconnectionDelay: 1000,
            // reconnectionAttempts: 5,
            // reconnectionDelayMax: 5000,
            query: {
                userId: user?._id
            }
        })
        socketRef.current = socket

        socket.on('getOnlineUsers', (users: string[]) => {
            setOnlineUsers(users)
        })

        // Connection event handlers
        // socket.on("connect", () => {
        //     console.log("Socket connected:", socket.id)
        //     setIsConnected(true)

        //     // Optionally emit user info to server
        //     // socket.emit("user:join", { userId: user._id })
        // })

        // socket.on("disconnect", () => {
        //     console.log("Socket disconnected")
        //     setIsConnected(false)
        // })

        // socket.on("connect_error", (error) => {
        //     console.error("Socket connection error:", error)
        //     setIsConnected(false)
        // })

        // Cleanup on unmount or user change
        return () => {
            if (socket) {
                socket.disconnect()
                socketRef.current = null
            }
        }
    }, [user?._id])

    const value: SocketContextProps = {
        socket: socketRef.current,
        onlineUsers
    }
    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}


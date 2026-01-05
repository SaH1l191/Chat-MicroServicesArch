# Socket Context Usage Guide

## Overview
The Socket context provides a centralized way to manage Socket.IO connections in your Next.js application. The socket automatically connects when a user is authenticated and disconnects when they log out.

## Basic Usage

### 1. Using the Socket Hook

```tsx
"use client"

import { useSocket } from "@/providers/SocketProvider"
import { useEffect } from "react"

export function MyComponent() {
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!socket || !isConnected) return

    // Listen for events
    socket.on("message:new", (data) => {
      console.log("New message received:", data)
      // Handle new message
    })

    socket.on("message:seen", (data) => {
      console.log("Message seen:", data)
      // Handle message seen
    })

    // Cleanup listeners on unmount
    return () => {
      socket.off("message:new")
      socket.off("message:seen")
    }
  }, [socket, isConnected])

  // Emit events
  const sendMessage = () => {
    if (socket && isConnected) {
      socket.emit("message:send", {
        chatId: "chat123",
        text: "Hello!",
      })
    }
  }

  return (
    <div>
      <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
      <button onClick={sendMessage}>Send Message</button>
    </div>
  )
}
```

### 2. Real-time Message Updates in ChatInterface

```tsx
"use client"

import { useSocket } from "@/providers/SocketProvider"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { chatKeys } from "@/lib/queries/chat"

export function ChatInterface({ chatId }: { chatId: string }) {
  const { socket, isConnected } = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket || !isConnected || !chatId) return

    // Listen for new messages in this chat
    const handleNewMessage = (data: any) => {
      if (data.chatId === chatId) {
        // Invalidate messages query to refetch
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(chatId),
        })
        // Also invalidate chats list to update last message
        queryClient.invalidateQueries({
          queryKey: chatKeys.chats,
        })
      }
    }

    // Listen for message seen updates
    const handleMessageSeen = (data: any) => {
      if (data.chatId === chatId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(chatId),
        })
      }
    }

    socket.on("message:new", handleNewMessage)
    socket.on("message:seen", handleMessageSeen)

    // Join the chat room
    socket.emit("chat:join", { chatId })

    return () => {
      socket.off("message:new", handleNewMessage)
      socket.off("message:seen", handleMessageSeen)
      // Leave the chat room
      socket.emit("chat:leave", { chatId })
    }
  }, [socket, isConnected, chatId, queryClient])

  // ... rest of component
}
```

### 3. Typing Indicators

```tsx
"use client"

import { useSocket } from "@/providers/SocketProvider"
import { useEffect, useState } from "react"

export function TypingIndicator({ chatId }: { chatId: string }) {
  const { socket, isConnected } = useSocket()
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  useEffect(() => {
    if (!socket || !isConnected) return

    socket.on("typing:start", (data: { userId: string; chatId: string }) => {
      if (data.chatId === chatId) {
        setTypingUsers((prev) => [...prev, data.userId])
      }
    })

    socket.on("typing:stop", (data: { userId: string; chatId: string }) => {
      if (data.chatId === chatId) {
        setTypingUsers((prev) => prev.filter((id) => id !== data.userId))
      }
    })

    return () => {
      socket.off("typing:start")
      socket.off("typing:stop")
    }
  }, [socket, isConnected, chatId])

  const handleTyping = () => {
    if (socket && isConnected) {
      socket.emit("typing:start", { chatId })
    }
  }

  const handleStopTyping = () => {
    if (socket && isConnected) {
      socket.emit("typing:stop", { chatId })
    }
  }

  return (
    <div>
      {typingUsers.length > 0 && (
        <p>{typingUsers.length} user(s) typing...</p>
      )}
      {/* Use handleTyping and handleStopTyping in your input component */}
    </div>
  )
}
```

## Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
# Or it will fallback to NEXT_PUBLIC_CHAT_API_URL
```

## Socket Events

The socket context manages the connection lifecycle. You can listen to and emit custom events based on your backend implementation.

### Common Events Pattern:
- `message:new` - New message received
- `message:seen` - Message marked as seen
- `chat:join` - Join a chat room
- `chat:leave` - Leave a chat room
- `typing:start` - User started typing
- `typing:stop` - User stopped typing
- `user:online` - User came online
- `user:offline` - User went offline

## Best Practices

1. **Always check connection status** before emitting events
2. **Clean up event listeners** in useEffect cleanup
3. **Use query invalidation** to sync socket events with React Query cache
4. **Handle reconnection** - the socket automatically reconnects, but you may want to re-join rooms
5. **Type your socket events** - create TypeScript interfaces for your socket event data



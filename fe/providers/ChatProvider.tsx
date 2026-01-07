"use client"

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import chatApi from "@/lib/chatApi"
import api from "@/lib/axios"
import { useUser } from "@/lib/queries/user"

// Types
export interface ChatUser {
  _id: string
  email: string
  name: string
}

export interface Chat {
  _id: string
  users: string[]
  latestMessage?: {
    text: string
    senderId: string
  }
  updatedAt: string
  unseenCount: number
}

export interface ChatWithUser {
  user: ChatUser
  chat: Chat
}

export interface Message {
  _id: string
  chatId: string
  sender: string
  text?: string
  image?: {
    url: string
    publicId: string
  }
  messageType: "text" | "image"
  seen: boolean
  seenAt?: string
  createdAt: string
}

interface ChatContextType {
  // Socket
  socket: Socket | null
  onlineUsers: string[]
  
  // Chats
  chats: ChatWithUser[]
  chatsLoading: boolean
  fetchChats: () => Promise<void>
  
  // Messages
  messages: Record<string, { messages: Message[]; user: ChatUser | null }>
  messagesLoading: Record<string, boolean>
  fetchMessages: (chatId: string) => Promise<void>
  
  // Actions
  sendMessage: (chatId: string, text: string, image?: File) => Promise<void>
  createChat: (otherUserId: string) => Promise<{ chatId: string }>
  
  // Typing
  typingStatus: Record<string, boolean>
  
  // All users
  allUsers: ChatUser[]
  allUsersLoading: boolean
  fetchAllUsers: () => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { data: user } = useUser()
  const socketRef = useRef<Socket | null>(null)
  
  const [socket, setSocket] = useState<Socket | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [chats, setChats] = useState<ChatWithUser[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [messages, setMessages] = useState<Record<string, { messages: Message[]; user: ChatUser | null }>>({})
  const [messagesLoading, setMessagesLoading] = useState<Record<string, boolean>>({})
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({})
  const [allUsers, setAllUsers] = useState<ChatUser[]>([])
  const [allUsersLoading, setAllUsersLoading] = useState(false)
  
  
  const activeChatRoomsRef = useRef<Set<string>>(new Set())

  
  useEffect(() => {
    if (!user?._id) {
      return
    }

    const socketUrl = process.env.NEXT_PUBLIC_CODEBASE === "production" 
      ? process.env.NEXT_PUBLIC_CHAT_API_URL 
      : "http://localhost:3002"

    const socket = io(socketUrl, {
      withCredentials: true,
      query: {
        userId: user._id
      }
    })

    socketRef.current = socket
    setSocket(socket)

    
    socket.on('getOnlineUsers', (users: string[]) => {
      setOnlineUsers(users)
    })

    socket.on('message:new', (data: { message: Message; chatId: string; senderId: string }) => {
      const { message, chatId, senderId } = data
      
      setMessages(prev => {
        const existing = prev[chatId]
        if (existing) {
          const messageExists = existing.messages.some(m => m._id === message._id)
          if (messageExists) {
            return {
              ...prev,
              [chatId]: {
                ...existing,
                messages: existing.messages.map(m => 
                  m._id === message._id ? message : m
                )
              }
            }
          }
          return {
            ...prev,
            [chatId]: {
              ...existing,
              messages: [...existing.messages, message]
            }
          }
        }
        return prev
      })

  
      setChats(prev => prev.map(chatWithUser => {
        if (chatWithUser.chat._id === chatId) {
          const latestMessageText = message.image ? "📷 Image" : (message.text || "")
          return {
            ...chatWithUser,
            chat: {
              ...chatWithUser.chat,
              latestMessage: {
                text: latestMessageText,
                senderId: senderId
              },
              updatedAt: message.createdAt,
              // Increment unseen count if message is from other user and not seen
              unseenCount: senderId !== user._id && !message.seen 
                ? (chatWithUser.chat.unseenCount || 0) + 1 
                : chatWithUser.chat.unseenCount
            }
          }
        }
        return chatWithUser
      }))
    })

    socket.on('message:read', (data: { chatId: string; messageIds: string[] }) => {
      const { chatId, messageIds } = data
      setMessages(prev => {
        const existing = prev[chatId]
        if (existing) {
          return {
            ...prev,
            [chatId]: {
              ...existing,
              messages: existing.messages.map(msg => 
                messageIds.includes(msg._id) 
                  ? { ...msg, seen: true, seenAt: new Date().toISOString() }
                  : msg
              )
            }
          }
        }
        return prev
      })
    })

    socket.on('typing:status', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      const { chatId, userId, isTyping } = data
      
      if (userId === user._id) return
      
      setTypingStatus(prev => ({
        ...prev,
        [chatId]: isTyping
      }))

      if (isTyping) {
        setTimeout(() => {
          setTypingStatus(prev => ({
            ...prev,
            [chatId]: false
          }))
        }, 4000)
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setSocket(null)
      activeChatRoomsRef.current.clear()
    }
  }, [user?._id])

  const fetchChats = useCallback(async () => {
    if (!user?._id) return
    
    setChatsLoading(true)
    try {
      const { data } = await chatApi.get<{ chats: any[] }>("/api/v1/chat/all")
      
      const formattedChats = data.chats
        .filter((chat) => chat !== null)
        .map((chat) => {
          let userData = chat.user
          if (userData && userData.user) {
            userData = userData.user
          }
          return {
            ...chat,
            user: userData,
          }
        })
        .filter((chat) => chat.user && chat.user._id)
      
      setChats(formattedChats)
      
      if (socketRef.current) {
        formattedChats.forEach(({ chat }) => {
          socketRef.current?.emit('join:chat', chat._id)
          activeChatRoomsRef.current.add(chat._id)
        })
      }
    } catch (error) {
      console.error("Error fetching chats:", error)
    } finally {
      setChatsLoading(false)
    }
  }, [user?._id])

  const fetchMessages = useCallback(async (chatId: string) => {
    if (!chatId || !user?._id) return
    
    setMessagesLoading(prev => ({ ...prev, [chatId]: true }))
    try {
      const { data } = await chatApi.get<{ messages: Message[]; user: ChatUser }>(
        `/api/v1/message/${chatId}`
      )
      
      setMessages(prev => ({
        ...prev,
        [chatId]: {
          messages: data.messages,
          user: data.user
        }
      }))

      if (socketRef.current && !activeChatRoomsRef.current.has(chatId)) {
        socketRef.current.emit('join:chat', chatId)
        activeChatRoomsRef.current.add(chatId)
      }

      if (socketRef.current) {
        socketRef.current.emit('viewing:chat', chatId)
      }

      fetchChats()
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setMessagesLoading(prev => ({ ...prev, [chatId]: false }))
    }
  }, [user?._id, onlineUsers, fetchChats])

  const sendMessage = useCallback(async (chatId: string, text: string, image?: File) => {
    if (!chatId || (!text.trim() && !image)) return

    const formData = new FormData()
    formData.append("chatId", chatId)
    formData.append("text", text)
    if (image) {
      formData.append("image", image)
    }

    try {
      const { data } = await chatApi.post<{
        message: Message
        messages: Message[]
        chat: Chat
      }>("/api/v1/message", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      setMessages(prev => {
        const existing = prev[chatId]
        return {
          ...prev,
          [chatId]: {
            ...existing,
            messages: data.messages,
            user: existing?.user || null
          }
        }
      })

      setChats(prev => prev.map(chatWithUser => 
        chatWithUser.chat._id === chatId
          ? { ...chatWithUser, chat: data.chat }
          : chatWithUser
      ))

      if (socketRef.current) {
        socketRef.current.emit('message:sent', {
          chatId,
          message: data.message,
          senderId: user?._id
        })
      }
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    }
  }, [user?._id])

  const createChat = useCallback(async (otherUserId: string): Promise<{ chatId: string }> => {
    const { data } = await chatApi.post<{ chatId: string; message?: string }>("/api/v1/chat/new", {
      otherUserId,
    })
    
    await fetchChats()
    
    return { chatId: data.chatId }
  }, [fetchChats])

  const fetchAllUsers = useCallback(async () => {
    setAllUsersLoading(true)
    try {
      const { data } = await api.post<{ users: ChatUser[] }>("/api/v1/user/all")
      setAllUsers(data.users)
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setAllUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?._id) {
      fetchChats()
      fetchAllUsers()
    }
  }, [user?._id, fetchChats, fetchAllUsers])

  useEffect(() => {
    if (!socketRef.current || !user?._id) return

    const handleUserJoinedRoom = (data: { chatId: string; userId: string }) => {
      const { chatId, userId } = data
      
      // if the other user joined the same room we're in, mark our unread messages as read
      if (activeChatRoomsRef.current.has(chatId) && userId !== user._id && onlineUsers.includes(userId)) {
        setMessages(prev => {
          const chatMessages = prev[chatId]
          if (!chatMessages) return prev
          
          const unreadMessageIds = chatMessages.messages
            .filter(msg => msg.sender === user._id && !msg.seen)
            .map(msg => msg._id)
          
          if (unreadMessageIds.length > 0) {
            socketRef.current?.emit('message:read', {
              chatId,
              messageIds: unreadMessageIds
            })
            
            return {
              ...prev,
              [chatId]: {
                ...chatMessages,
                messages: chatMessages.messages.map(msg =>
                  unreadMessageIds.includes(msg._id)
                    ? { ...msg, seen: true, seenAt: new Date().toISOString() }
                    : msg
                )
              }
            }
          }
          return prev
        })
      }
    }

    socketRef.current.on('user:joined:room', handleUserJoinedRoom)
    
    return () => {
      socketRef.current?.off('user:joined:room', handleUserJoinedRoom)
    }
  }, [user?._id, onlineUsers])

  const value: ChatContextType = {
    socket,
    onlineUsers,
    chats,
    chatsLoading,
    fetchChats,
    messages,
    messagesLoading,
    fetchMessages,
    sendMessage,
    createChat,
    typingStatus,
    allUsers,
    allUsersLoading,
    fetchAllUsers,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}


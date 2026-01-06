'use client'
import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import chatApi from "@/lib/chatApi"
import api from "@/lib/axios"

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


export const chatKeys = {
  chats: ["chats"] as const,
  messages: (chatId: string) => ["message", chatId] as const,
}

export const userKeys = {
  list: ["users"] as const,
}


export const fetchAllChats = async (): Promise<ChatWithUser[]> => {
  const { data } = await chatApi.get<{ chats: any[] }>("/api/v1/chat/all")
  
  
  return data.chats
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
}


export const fetchMessages = async (chatId: string): Promise<{
  messages: Message[]
  user: ChatUser
}> => {
  const { data } = await chatApi.get<{ messages: Message[]; user: ChatUser }>(
    `/api/v1/message/${chatId}`
  )
  return data
}


export const fetchAllUsers = async (): Promise<ChatUser[]> => {
  const { data } = await api.post<{ users: ChatUser[] }>("/api/v1/user/all")
  return data.users
}


export const createChat = async (otherUserId: string): Promise<{ chatId: string }> => {
  const { data } = await chatApi.post<{ chatId: string; message?: string }>("/api/v1/chat/new", {
    otherUserId,
  })
  return { chatId: data.chatId }
}



export function useChats() {
  return useQuery({
    queryKey: chatKeys.chats,
    queryFn: fetchAllChats,
    staleTime: 30 * 1000, 
    
  })
}

export function useMessages(chatId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: chatKeys.messages(chatId || ""),
    queryFn: () => fetchMessages(chatId!),
    enabled: !!chatId,
    staleTime: 10 * 1000, 
  })

  // When messages are successfully fetched, they get marked as seen on the backend
  // Invalidate chats list to update unseen count
  useEffect(() => {
    if (query.isSuccess && chatId) {
      queryClient.invalidateQueries({ queryKey: chatKeys.chats })
    }
  }, [query.isSuccess, chatId, queryClient])

  return query
}

export function useAllUsers() {
  return useQuery({
    queryKey: userKeys.list,
    queryFn: fetchAllUsers,
    staleTime: 5 * 60 * 1000, 
  })
}

export function useCreateChat() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.chats })
    },
  })
}

export const sendMessageAPI = async (
  chatId: string,
  text: string,
  image?: File
): Promise<{
  message: Message
  messages: Message[]
  chat: Chat
}> => {
  const formData = new FormData()
  formData.append("chatId", chatId)
  formData.append("text", text)
  if (image) {
    formData.append("image", image)
  }
  const { data } = await chatApi.post<{
    message: Message
    messages: Message[]
    chat: Chat
  }>("/api/v1/message", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
  return data
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ chatId, text, image }: { chatId: string; text: string; image?: File }) =>
      sendMessageAPI(chatId, text, image),
    onSuccess: (response, { chatId }) => {
      //  existing user data from cache
      const existingData = queryClient.getQueryData<{
        messages: Message[]
        user: ChatUser
      }>(chatKeys.messages(chatId))

      // Update messages cache with new messages, preserving user from existing cache
      queryClient.setQueryData(chatKeys.messages(chatId), {
        messages: response.messages,
        user: existingData?.user || { _id: "", name: "Unknown", email: "" }
      })

      // Update chats list cache for this chat
      queryClient.setQueryData(chatKeys.chats, (chats: ChatWithUser[] | undefined) =>
        chats?.map((c) =>
          c.chat._id === chatId
            ? { ...c, chat: { ...c.chat, ...response.chat } }
            : c
        )
      )
    },
  })
}


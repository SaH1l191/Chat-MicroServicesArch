"use client"

import { useState, useEffect } from "react"
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { ChatInterface } from "@/components/chat/ChatInterface"
import { MessageInput } from "@/components/chat/SimpleMessageInput"
import type { ChatUser } from "@/lib/queries/chat"
import { useSocket } from "@/providers/SocketProvider"
import { useChats } from "@/lib/queries/chat"
import { useUser } from "@/lib/queries/user"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  //chatUser type is id , email , name 
  // Track typing status per chat: { [chatId]: boolean }
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({})

  const { socket } = useSocket()
  const { data: chats } = useChats()

  useEffect(() => {
    if (!socket || !chats || chats.length === 0) return

    chats.forEach(({ chat }) => {
      socket.emit('join:chat', chat._id)
    })

    //clearnup on unmountintg 
    return () => {
      // Leaving all rooms on cleanup
      chats.forEach(({ chat }) => {
        socket.emit('leave:chat', chat._id)
      })
    }
  }, [socket, chats])

  const handleSelectChat = (chatId: string, user: ChatUser) => {
    // Don't leave previous chat - we want to stay in all chat rooms to receive typing events
    setSelectedChatId(chatId)
    setSelectedUser(user)
    // Ensure we're in this chat room (should already be joined from initial load, but just in case)
    if (socket && chatId) {
      socket.emit('join:chat', chatId)
    }
  }

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user)
  }

  const { onlineUsers } = useSocket()
  const { data: currentUser } = useUser()

  // Listening  for typing events from other users in all chat rooms
  useEffect(() => {
    if (!socket || !chats || !currentUser?._id) return
    const typingTimeouts: Record<string, NodeJS.Timeout> = {}
    const handleTypingStatus = (data: { chatId: string; userId: string; isTyping: boolean }) => { 
      const chat = chats.find(c => c.chat._id === data.chatId)
      if (!chat) return

      // Only track typing if it's from the other user (not the current user)
      const otherUserId = chat.user._id
      if (data.userId === currentUser._id) return // Ignoring typing
      if (data.userId !== otherUserId) return //track the other 

      // Clear any existing timeout for this chat
      if (typingTimeouts[data.chatId]) {
        clearTimeout(typingTimeouts[data.chatId])
        delete typingTimeouts[data.chatId]
      }

      // Update typing status for this chat
      setTypingStatus(prev => ({
        ...prev,
        [data.chatId]: data.isTyping
      }))

      // If user started typing, set a safety timeout to clear it after 4 seconds
      // (in case stop event is not received due to connection issues)
      if (data.isTyping) {
        typingTimeouts[data.chatId] = setTimeout(() => {
          setTypingStatus(prev => ({
            ...prev,
            [data.chatId]: false
          }))
          delete typingTimeouts[data.chatId]
        }, 4000)
      }
    }

    socket.on('typing:status', handleTypingStatus)

    return () => {
      socket.off('typing:status', handleTypingStatus)
      Object.values(typingTimeouts).forEach(timeout => clearTimeout(timeout))
    }
  }, [socket, chats, currentUser?._id])

  //
  const isUserTyping = selectedChatId ? typingStatus[selectedChatId] || false : false

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 shrink-0 ">
        <ChatSidebar
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          onlineUsers={onlineUsers}
          typingStatus={typingStatus}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex-1 flex flex-col ">
          <ChatInterface chatId={selectedChatId} selectedUser={selectedUser} onlineUsers={onlineUsers}
            isUserTyping={isUserTyping} />
        </div>
        <MessageInput chatId={selectedChatId} />
      </div>
    </div>
  )
}


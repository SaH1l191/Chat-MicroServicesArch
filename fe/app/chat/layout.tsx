"use client"

import { useState, useEffect } from "react"
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { ChatInterface } from "@/components/chat/ChatInterface"
import { MessageInput } from "@/components/chat/SimpleMessageInput"
import type { ChatUser } from "@/providers/ChatProvider"
import { useChat } from "@/providers/ChatProvider"
import { useUser } from "@/lib/queries/user"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  //chatUser type is id , email , name 
  const { socket, chats, typingStatus } = useChat()

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
    if (socket && chatId) {
      socket.emit('join:chat', chatId)
      // Notify backend that user is viewing this chat
      socket.emit('viewing:chat', chatId)
    }
  }

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user)
  }

  const { onlineUsers } = useChat()
  const { data: currentUser } = useUser()

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


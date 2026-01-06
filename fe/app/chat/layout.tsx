"use client"

import { useState } from "react"
import { ChatSidebar } from "@/components/chat/ChatSidebar"
import { ChatInterface } from "@/components/chat/ChatInterface"
import { MessageInput } from "@/components/chat/MessageInput"
import type { ChatUser } from "@/lib/queries/chat"
import { useSocket } from "@/providers/SocketProvider"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)

  const handleSelectChat = (chatId: string, user: ChatUser) => {
    setSelectedChatId(chatId)
    setSelectedUser(user)
  }

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user)
  }

  const { onlineUsers } = useSocket()
  console.log("onlineusers ", onlineUsers)

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 shrink-0 ">
        <ChatSidebar
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onSelectUser={handleSelectUser}
          onlineUsers={onlineUsers}
          selectedUser ={selectedUser}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex-1 flex flex-col ">
          <ChatInterface chatId={selectedChatId} selectedUser={selectedUser} onlineUsers={onlineUsers} />

        </div>
        <MessageInput chatId={selectedChatId} />
      </div>
    </div>
  )
}


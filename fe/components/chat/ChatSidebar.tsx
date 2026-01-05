"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { useChats, useAllUsers, useCreateChat, type ChatWithUser, type ChatUser } from "@/lib/queries/chat"
import { useUser } from "@/lib/queries/user"
import { Search, MessageSquare, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatSidebarProps {
  selectedChatId: string | null
  onSelectChat: (chatId: string, user: ChatUser) => void
  onSelectUser: (user: ChatUser) => void,
  onlineUsers: string[]
}

export function ChatSidebar({ selectedChatId, onSelectChat, onSelectUser, onlineUsers }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAllUsers, setShowAllUsers] = useState(false)
  const { data: currentUser } = useUser()
  const { data: chats, isLoading: chatsLoading } = useChats()
  const { data: allUsers, isLoading: usersLoading } = useAllUsers()
  const createChatMutation = useCreateChat()

  const handleUserClick = async (user: ChatUser) => {
    // Check if chat already exists
    const existingChat = chats?.find(
      (chat) => chat.user._id === user._id
    )

    if (existingChat) {
      onSelectChat(existingChat.chat._id, user)
    } else {
      // Create new chat
      try {
        const result = await createChatMutation.mutateAsync(user._id)
        onSelectChat(result.chatId, user)
      } catch (error) {
        console.error("Failed to create chat:", error)
      }
    }
    setShowAllUsers(false)
    setSearchQuery("")
  }

  const filteredUsers = allUsers?.filter(
    (user) =>
      user?._id !== currentUser?._id &&
      user?.name &&
      user?.email &&
      (user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredChats = chats
    ?.filter((chat) => chat?.user && chat.user.name && chat.user.email) // Remove invalid chats first
    ?.filter(
      (chat) =>
        chat.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

  return (
    <div className="flex flex-col h-full border-r bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Chats</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats or users..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowAllUsers(e.target.value.length > 0)
            }}
            className="pl-8"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showAllUsers ? (
          // Show all users when searching
          <div className="p-2">
            {usersLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredUsers && filteredUsers.length > 0 ? (
              <div className="space-y-1">
                {filteredUsers.map((user) => {
                  if (!user || !user.name || !user.email) {
                    return null
                  }
                  return (
                    <div
                      key={user._id}
                      onClick={() => handleUserClick(user)}
                      className="p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {user.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.name || "Unknown User"}</p>
                          {/* show online badge */}
                          {onlineUsers?.includes(user._id) && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium leading-none rounded-full bg-green-100 text-green-800">
                              Online
                            </span>
                          )}

                          <p className="text-sm text-muted-foreground truncate">{user.email || ""}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No users found
              </div>
            )}
          </div>
        ) : (
          // Show chats list
          <div className="p-2">
            {chatsLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredChats && filteredChats.length > 0 ? (
              <div className="space-y-1">
                {filteredChats.map(({ chat, user }) => {
                  if (!user || !user.name || !user.email) {
                    return null
                  }
                  return (
                    <div
                      key={chat._id}
                      onClick={() => onSelectChat(chat._id, user)}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-colors",
                        selectedChatId === chat._id
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center relative">
                          <span className="text-sm font-medium">
                            {user.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                          {chat.unseenCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                              {chat.unseenCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.name || "Unknown User"}</p>
                          {chat.latestMessage && (
                            <p className="text-sm text-muted-foreground truncate">
                              {chat.latestMessage.text}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No chats yet. Search for users to start a conversation.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


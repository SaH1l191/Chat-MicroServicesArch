"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useChat, type ChatUser } from "@/providers/ChatProvider"
import { useUser, useUpdateUserName, useLogout } from "@/lib/queries/user"
import { Search, MessageSquare, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation"

interface ChatSidebarProps {
  selectedChatId: string | null
  onSelectChat: (chatId: string, user: ChatUser) => void
  onSelectUser: (user: ChatUser) => void,
  selectedUser: ChatUser | null
  onlineUsers: string[]
  typingStatus: Record<string, boolean> // { [chatId]: isTyping }
}

export function ChatSidebar({ selectedChatId, onSelectChat, onlineUsers, selectedUser, typingStatus }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const { data: currentUser } = useUser()
  const { chats, chatsLoading, allUsers, allUsersLoading, createChat } = useChat()
  const updateNameMutation = useUpdateUserName()
  const logout = useLogout()
  const handleSettings = () => {
    if (currentUser) {
      setNewName(currentUser.name || "")
    }
    setSettingsOpen((prev) => !prev)
  }

  const router = useRouter()
  const handleSubmitName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed || updateNameMutation.isPending) return

    try {
      await updateNameMutation.mutateAsync(trimmed)
      setSettingsOpen(false)
    } catch (error) {
      console.error("Failed to update name", error)
    }
  }

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
        const result = await createChat(user._id)
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
    // ?.filter((chat) => chat?.user && chat.user.name && chat.user.email) // Remove invalid chats first
    ?.filter(
      (chat) =>
        chat.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

 
  return (
    <div className="flex flex-col h-full border-r bg-background">
      <div className="flex flex-col flex-1">
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
              {allUsersLoading ? (
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
                            <span className={`${onlineUsers.includes(user._id) ? 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white' : ''}`}></span>
                            {typingStatus[chat._id] && (
                              <div className="text-green-500 absolute -bottom-3 -right-6 flex items-center justify-center rounded-full px-2 py-1 text-xs">
                                typing...
                              </div>
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

        {/* Current user section pinned to bottom */}
        {currentUser && (
          <div className="mt-auto flex flex-col p-4 gap-2 border-t relative">
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                selectedUser && selectedUser._id === currentUser._id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
              onClick={handleSettings}
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium ">
                  {currentUser.name?.charAt(0)?.toUpperCase() ||
                    currentUser.email?.charAt(0)?.toUpperCase() ||
                    "?"}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium truncate max-w-40 text-left justify-start">
                  {currentUser.name || currentUser.email}
                </span>
                {currentUser.name && (
                  <span className="text-xs text-muted-foreground truncate max-w-40">
                    {currentUser.email}
                  </span>
                )}
              </div>
            </div>

            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg  transition-colors",
               
              )} 
            >
              <Button onClick={async() => logout.mutate(undefined,{
                onSuccess : ()=>router.push("/")
              })} className="w-fit cursor-pointer">Logout</Button>
            </div>

            {settingsOpen && (
              <div className="absolute gap-y-4 bottom-20 right-4 w-64 rounded-md border bg-popover p-3 shadow-lg z-10">
                <form className="space-y-4" onSubmit={handleSubmitName}>
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Change display name
                    </p>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter new name"
                      autoFocus
                    />
                    <hr className="" /> 
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSettingsOpen(false)}
                      >
                        Cancel
                      </Button>
                      
                      <Button
                        type="submit"
                        size="sm"
                        disabled={updateNameMutation.isPending || !newName.trim()}
                      >
                        {updateNameMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                  
                </form>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

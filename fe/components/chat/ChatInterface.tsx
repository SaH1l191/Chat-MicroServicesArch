"use client"

import { useEffect, useRef, useCallback } from "react"
import { useChat, type Message } from "@/providers/ChatProvider"
import { useUser } from "@/lib/queries/user"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface ChatInterfaceProps {
  chatId: string | null
  selectedUser: { _id: string; name: string; email: string } | null
  onlineUsers: string[]
  isUserTyping: boolean
}

export function ChatInterface({ chatId, selectedUser, onlineUsers, isUserTyping }: ChatInterfaceProps) {
  const { data: currentUser } = useUser()
  const { messages, messagesLoading, fetchMessages, socket } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const messagesData = chatId ? messages[chatId] : null
  const messageList = messagesData?.messages || []
  const isLoading = chatId ? (messagesLoading[chatId] || false) : false

  // Fetch messages when chatId changes
  useEffect(() => {
    if (chatId) {
      fetchMessages(chatId)
      
    }

    // Cleanup: notify backend when user stops viewing this chat
    return () => {
      if (chatId && socket) {
        socket.emit('not:viewing:chat')
      }
    }
  }, [chatId, fetchMessages, socket])

  console.log("messages " , messages)



  //everything related to scrolling 
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messageList])
  const lastRefetchRef = useRef<number>(0)
  const handleScroll = useCallback(async () => {
    if (!messagesContainerRef.current || !chatId) return

    const container = messagesContainerRef.current
    const isAtBottom =
      container.scrollHeight - container.scrollTop <= container.clientHeight + 50

    const now = Date.now()
    if (isAtBottom && now - lastRefetchRef.current > 2000) {
      lastRefetchRef.current = now
      try {
        // scroll bottom => new messages seen -> refetch messages
        await fetchMessages(chatId)
      } catch (error) {
        console.error("Error refetching messages:", error)
      }
    }
  }, [chatId, fetchMessages])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    container.addEventListener("scroll", handleScroll)
    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])


  // edge case
  if (!chatId || !selectedUser) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Select a chat to start messaging
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header of the person we are chatting with  */}
      <div className="p-4 border-b bg-background  top-0 sticky">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center relative justify-center">
            <span className="text-sm font-medium">
              {selectedUser.name.charAt(0).toUpperCase()}
            </span>
            {/* add a online status  badge */}
            <span className={`${onlineUsers.includes(selectedUser?._id) ? 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white' : ''}`}></span>

            {/* typing */}
            {isUserTyping && (
              <div className="text-green-500 absolute -bottom-3 -right-6 flex items-center justify-center rounded-full  px-2 py-1 text-xs  ">
                typing...
              </div>
            )}
          </div>
          <div>
            <p className="font-medium">{selectedUser.name}</p>
            <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messageList.length > 0 ? (
          messageList.map((message: Message) => {
            const isOwnMessage = message.sender === currentUser?._id
            // Use message._id as key (should be unique after deduplication)
            // Add fallback for edge cases
            const messageKey = message._id || `msg-${message.createdAt}-${message.sender}`
            return (
              <div
                key={messageKey}
                className={cn(
                  "flex",
                  isOwnMessage ? "justify-end" : "justify-start"
                )}
              >
                {/* message Body + css for formatiing  */}
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg p-3",
                    isOwnMessage
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >

                  {/* message image   */}
                  {message.image && (
                    <div className="mb-2">
                      <img
                        src={message.image.url}
                        alt="Shared"
                        className="rounded-lg max-w-full h-auto max-h-64 object-cover"
                      />
                    </div>
                  )}

                  {/* message text  */}
                  {message.text && (
                    <p className={cn(isOwnMessage ? "text-primary-foreground" : "")}>
                      {message.text}
                    </p>
                  )}


                  {/* date + ticks  */}
                  <div
                    className={cn(
                      "text-xs mt-1 flex items-center gap-2",
                      isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    <span>
                      {(() => {
                        if (!message.createdAt) return "--:--";
                        try {
                          const date = new Date(message.createdAt);
                          if (isNaN(date.getTime())) {
                            console.warn("Invalid date:", message.createdAt);
                            return "--:--";
                          }
                          return format(date, "HH:mm");
                        } catch (error) {
                          console.error("Date formatting error:", error, message.createdAt);
                          return "--:--";
                        }
                      })()}
                    </span>
                    {isOwnMessage && (
                      <span className={cn(
                        message.seen ? "text-blue-500" : ""
                      )}>
                        {message.seen ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}


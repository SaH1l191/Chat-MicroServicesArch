"use client"

import { useEffect, useRef, useCallback } from "react"
import { useMessages, type Message, chatKeys } from "@/lib/queries/chat"
import { useUser } from "@/lib/queries/user"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Image as ImageIcon } from "lucide-react"
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
  // console.log("currentIdUser", currentUser)
  const { data: messagesData, isLoading, refetch } = useMessages(chatId)
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const messages = messagesData?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])


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
        // scroll bottom => new messages seen -> invalidate this chatId 
        await refetch()
        queryClient.invalidateQueries({ queryKey: chatKeys.chats })
      } catch (error) {
        console.error("Error refetching messages:", error)
      }
    }
  }, [chatId, refetch, queryClient])

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
    <div className="flex flex-col h-full">
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-hidden p-4 space-y-4 h-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length > 0 ? (
          messages.map((message: Message) => {
            const isOwnMessage = message.sender === currentUser?._id
            return (
              <div
                key={message._id}
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
                      {format(new Date(message.createdAt), "HH:mm")}
                    </span>
                    {isOwnMessage && (
                      <span className="">{message.seen ? "✓✓" : "✓"}</span>
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


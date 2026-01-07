"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChat } from "@/providers/ChatProvider"
import { Send, Image as ImageIcon, X } from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@/lib/queries/user"

interface MessageInputProps {
  chatId: string | null
  disabled?: boolean
}

export function MessageInput({ chatId, disabled }: MessageInputProps) {
  const [text, setText] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sendMessage, socket } = useChat()
  const { data: currentUser } = useUser()
  const [isSending, setIsSending] = useState(false)

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef<boolean>(false)

  const startTyping = () => {
    if (!socket || !chatId || !currentUser?._id) return
    if (isTypingRef.current === true) return
    isTypingRef.current = true
    socket.emit("typing:start", { chatId, userId: currentUser._id })
  }

  const stopTyping = () => {
    if (!socket || !chatId || !currentUser?._id) return
    if (isTypingRef.current === false) return
    isTypingRef.current = false
    socket.emit("typing:stop", { chatId, userId: currentUser._id })
  }

  const scheduleStopTyping = () => {
    //egdeacase if there is some preivous timeout , clear it
    if (typingTimerRef.current !== null) clearTimeout(typingTimerRef.current)
      //set a fresh timeout here for current typed letter which stops typing after 4 seconds
      typingTimerRef.current = setTimeout(() => {
      stopTyping()
      typingTimerRef.current = null
    }, 4000)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB")
        return
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file")
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    if (!chatId) {
      toast.error("Please select a chat")
      return
    }
    if (!text.trim() && !selectedImage) {
      return
    }
    try {
      setIsSending(true)
      // Stop typing when sending message
      stopTyping()
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
      await sendMessage(chatId, text.trim(), selectedImage || undefined)
      setText("")
      handleRemoveImage()
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  const handleSetText = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value
    setText(newText)
    const hasText = newText.trim().length > 1 // Only emit when length > 1 as user mentioned

    if (hasText) {
      startTyping()
      scheduleStopTyping()
    } else {
      // User cleared the input, stop typing immediately
      stopTyping()
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
    }
  }

  // Cleanup typing status when chat changes or component unmounts
  useEffect(() => {
    // Clear any existing timeout on chat switch
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }
    // Ensure not marked as typing when chat changes
    stopTyping()

    return () => {
      // Cleanup on unmount
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
      stopTyping()
    }
  }, [chatId, socket, currentUser?._id])

  if (!chatId) {
    return null
  }

  return (
    <div className="p-4 border-t bg-background sticky bottom-0">
      {imagePreview && (
        <div className="mb-3 relative inline-block">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-32 w-32 object-cover rounded-lg border"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemoveImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={handleSetText}
          onKeyPress={handleKeyPress}
          disabled={disabled || isSending}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || isSending || (!text.trim() && !selectedImage)}
          size="icon"
        >
          {isSending ? (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

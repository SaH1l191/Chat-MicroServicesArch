"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSendMessage } from "@/lib/queries/chat"
import { Send, Image as ImageIcon, X } from "lucide-react"
import { toast } from "sonner"

interface MessageInputProps {
  chatId: string | null
  disabled?: boolean
}

export function MessageInput({ chatId, disabled }: MessageInputProps) {
  const [text, setText] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendMessageMutation = useSendMessage()

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
      await sendMessageMutation.mutateAsync({
        chatId,
        text: text.trim(),
        image: selectedImage || undefined,
      })
      setText("")
      handleRemoveImage()
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send message")
    }
  }



  if (!chatId) {
    return null
  }
// className="sticky bottom-0"
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
          disabled={disabled || sendMessageMutation.isPending}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled || sendMessageMutation.isPending}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || sendMessageMutation.isPending || (!text.trim() && !selectedImage)}
          size="icon"
        >
          {sendMessageMutation.isPending ? (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}


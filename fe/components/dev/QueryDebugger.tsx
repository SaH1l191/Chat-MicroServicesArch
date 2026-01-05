"use client"

import { useQueryObserver, useQueryKeyObserver } from "@/hooks/useQueryObserver"
import { chatKeys } from "@/lib/queries/chat"
import { useState } from "react"

/**
 * Development component to observe and debug React Query cache
 * Only use this in development mode
 */
export function QueryDebugger() {
  const [observeAll, setObserveAll] = useState(false)
  const [observeChats, setObserveChats] = useState(false)
  const [observeMessages, setObserveMessages] = useState(false)
  const [chatId, setChatId] = useState("")

  // Always call hooks unconditionally, but pass enabled state
  useQueryObserver(observeAll)
  useQueryKeyObserver(chatKeys.chats, observeChats)
  useQueryKeyObserver(
    chatId ? chatKeys.messages(chatId) : [],
    observeMessages && !!chatId
  )

  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs z-50 max-w-sm">
      <div className="font-bold mb-2">🔍 Query Debugger</div>
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={observeAll}
            onChange={(e) => setObserveAll(e.target.checked)}
          />
          <span>Observe All Queries</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={observeChats}
            onChange={(e) => setObserveChats(e.target.checked)}
          />
          <span>Observe Chats List</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={observeMessages}
            onChange={(e) => setObserveMessages(e.target.checked)}
          />
          <span>Observe Messages</span>
        </div>
        {observeMessages && (
          <input
            type="text"
            placeholder="Enter chatId"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="w-full px-2 py-1 bg-white/10 rounded text-white placeholder-white/50"
          />
        )}
        <div className="text-xs text-gray-400 mt-2">
          Check browser console for logs
        </div>
      </div>
    </div>
  )
}


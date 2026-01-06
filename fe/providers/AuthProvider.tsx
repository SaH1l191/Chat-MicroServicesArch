"use client"

import { useEffect, ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { setQueryClient } from "@/lib/axios"
import { setChatQueryClient } from "@/lib/chatApi"
// import { QueryDebugger } from "@/components/dev/QueryDebugger"

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // Register query client with axios interceptors
  useEffect(() => {
    setQueryClient(queryClient)
    setChatQueryClient(queryClient)
  }, [queryClient])

  return (
    <>
      {children}
      {/* <QueryDebugger /> */}
    </>
  )
}


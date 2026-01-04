"use client"

import { useEffect, ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { setQueryClient } from "@/lib/axios"

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // Register query client with axios interceptor
  useEffect(() => {
    setQueryClient(queryClient)
  }, [queryClient])

  return <>{children}</>
}


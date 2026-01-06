"use client"

import { ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

// import { QueryDebugger } from "@/components/dev/QueryDebugger"

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  
  return (
    <>
      {children}
      {/* <QueryDebugger /> */}
    </>
  )
}


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/axios"

export interface User {
  _id: string
  email: string
  name: string
}

interface UserResponse {
  user: User
}

interface UpdateNameResponse {
  message: string
  user: User
  token: string
}

// Query key factory
export const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
}

// Fetch current user
export const fetchUser = async (): Promise<User | null> => {
  try {
    const { data } = await api.get<UserResponse>("/api/v1/me")
    return data.user
  } catch (error) {
    return null
  }
}

// Hook to get current user
export function useUser() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  })
}

// Update current user's name
export function useUpdateUserName() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<UpdateNameResponse>("/api/v1/update/user", {
        name,
      })
      console.log("Data from update User ",data)
      return data
    },
    onSuccess: (data) => {
      // Update cached "me" data with the updated user
      queryClient.setQueryData(userKeys.me(), data.user)
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

// Logout mutation
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/v1/logout")
      return data
    },
    onSuccess: () => {
      // Clear user query cache
      queryClient.setQueryData(userKeys.me(), null)
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
    onError: () => {
      // Even if logout fails, clear user state
      queryClient.setQueryData(userKeys.me(), null)
    },
  })
}


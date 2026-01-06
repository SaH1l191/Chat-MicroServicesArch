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
 
export const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
}


export const fetchUser = async (): Promise<User | null> => {
  try {
    const { data } = await api.get<UserResponse>("/api/v1/me")
    return data.user
  } catch (error) {
    return null
  }
}


export function useUser() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  })
}


export function useUpdateUserName() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<UpdateNameResponse>("/api/v1/update/user", {
        name,
      })
      console.log("Data from update User ", data)
      return data
    },
    onSuccess: (data) => {


      queryClient.setQueryData(userKeys.me(), data.user)
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}


export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/v1/logout")
      return data
    },
    onSuccess: () => {
      queryClient.setQueryData(userKeys.me(), null)
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
    onError: () => {
      queryClient.setQueryData(userKeys.me(), null)
    },
  })
}


import axios from "axios"

const chatApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CHAT_API_URL || "http://localhost:3002",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

let isRefreshing = false
// let failedQueue: Array<{
//   resolve: (value?: any) => void
//   reject: (error?: any) => void
// }> = []

// const processQueue = (error: any = null) => {
//   failedQueue.forEach((prom) => {
//     if (error) {
//       prom.reject(error)
//     } else {
//       prom.resolve()
//     }
//   })
//   failedQueue = []
// }




chatApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config


    const isRefreshEndpoint = originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/api/v1/auth/refresh")


    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshEndpoint
    ) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          // failedQueue.push({
          resolve: () => { }
          //     chatApi(originalRequest).then(resolve).catch(reject)
          //   },
          //   reject
          // })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {

        const refreshResponse = await axios.get(
          
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/v1/auth/refresh`,
          {
            withCredentials: true,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
        // processQueue(null)
        isRefreshing = false
        // Retry the original request
        return chatApi(originalRequest)
      } catch (refreshError) {
        isRefreshing = false
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }

        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default chatApi


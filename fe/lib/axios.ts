import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_APP_URL, // e.g. http://localhost:3000
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Store a reference to the query client for invalidating queries
let queryClientRef: any = null

export const setQueryClient = (client: any) => {
    queryClientRef = client
}

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false
let failedQueue: Array<{
    resolve: (value?: any) => void
    reject: (error?: any) => void
}> = []

const processQueue = (error: any = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error)
        } else {
            prom.resolve()
        }
    })
    failedQueue = []
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        // Skip if this is the refresh endpoint itself
        const isRefreshEndpoint = originalRequest.url?.includes("/auth/refresh") || 
                                   originalRequest.url?.includes("/api/v1/auth/refresh")

        // Don't retry refresh endpoint or if already retried
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !isRefreshEndpoint
        ) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ 
                        resolve: () => {
                            api(originalRequest).then(resolve).catch(reject)
                        }, 
                        reject 
                    })
                })
            }

            originalRequest._retry = true
            isRefreshing = true

            try {
                // Refresh token endpoint is GET /api/v1/auth/refresh
                // Create a new request config to avoid interception
                const refreshResponse = await axios.get(
                    `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/refresh`,
                    {
                        withCredentials: true,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                )

                // Process queued requests
                processQueue(null)
                isRefreshing = false

                // Retry the original request
                return api(originalRequest)
            } catch (refreshError) {
                // Refresh failed, process queue with error
                processQueue(refreshError)
                isRefreshing = false

                // Clear user data and redirect to login
                if (queryClientRef) {
                    queryClientRef.setQueryData(["user", "me"], null)
                }

                // Only redirect if not already on login page
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login"
                }

                return Promise.reject(refreshError)
            }
        }

        return Promise.reject(error)
    }
)

export default api

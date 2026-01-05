import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
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

// Simple flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        // Skip if this is the refresh endpoint itself or already retried
        const isRefreshEndpoint = originalRequest.url?.includes("/auth/refresh")
 
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !isRefreshing &&
            !isRefreshEndpoint
        ) {
            originalRequest._retry = true
            isRefreshing = true

            try {
                // Silently refresh token
                await axios.get(
                    `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/refresh`,
                    {
                        withCredentials: true,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                )

                isRefreshing = false
                // Retry the original request
                return api(originalRequest)
            } catch (refreshError) {
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

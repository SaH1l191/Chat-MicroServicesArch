import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});


//  to prevent multiple simultaneous refresh attempts
let isRefreshing = false
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config 
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
                return api(originalRequest)
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

export default api

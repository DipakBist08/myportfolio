import axios from 'axios'
import { useAuthStore } from '@/store/auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Inject access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: { resolve: (v: string) => void; reject: (e: unknown) => void }[] = []

const processQueue = (error: unknown, token?: string) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  failedQueue = []
}

// A 401 from these means a wrong password, code or link, not an expired
// session, so it must reach the page as it is instead of starting a refresh.
const AUTH_CALLS = ['/auth/login', '/auth/mfa/verify', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password']
const isAuthCall = (url?: string) => !!url && AUTH_CALLS.some((path) => url.includes(path))

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall(original.url)) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }
      original._retry = true
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        // Nothing to refresh with: sign out. isRefreshing is only set below,
        // after this check. Setting it before returning here left it true for
        // good, and every later 401 (a wrong password included) then waited
        // forever for a refresh that never ran: Sign In spun with no message.
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }
      isRefreshing = true
      try {
        const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken }, { timeout: 10_000 })
        const newAccess = res.data.access_token
        const newRefresh = res.data.refresh_token
        useAuthStore.getState().setTokens(newAccess, newRefresh)
        processQueue(null, newAccess)
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch (err) {
        processQueue(err)
        useAuthStore.getState().logout()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api

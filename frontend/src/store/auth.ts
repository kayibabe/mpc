import { create } from 'zustand'
import { authApi, type CurrentUser } from '../api/auth'

interface AuthState {
  user: CurrentUser | null
  isLoading: boolean
  login: (employee_id: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (employee_id, password) => {
    set({ isLoading: true })
    try {
      const { data } = await authApi.login(employee_id, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const me = await authApi.me()
      set({ user: me.data, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null })
  },

  fetchMe: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isLoading: false })
      return
    }
    set({ isLoading: true })
    try {
      const { data } = await authApi.me()
      set({ user: data, isLoading: false })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ isLoading: false })
    }
  },
}))

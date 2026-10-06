import { create } from 'zustand'
import type { Database } from '@music-flow/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: { id: string; email?: string } | null
  profile: Profile | null
  isLoading: boolean
  preferredLanguage: string
  setAuth: (user: { id: string; email?: string } | null, profile: Profile | null) => void
  setLoading: (isLoading: boolean) => void
  setLanguage: (lang: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  preferredLanguage: 'es',
  setAuth: (user, profile) => set({ user, profile, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setLanguage: (preferredLanguage) => set({ preferredLanguage }),
}))

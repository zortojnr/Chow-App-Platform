// Auth store — holds the current session user for client-side access.
// frontend-standards.md §3.3 — Zustand is used only for auth state and
// UI preferences, never for server data.
//
// Population: the admin layout syncs useSession() into this store via
// a useEffect on every session change.
//
// Usage: read session role for conditional UI rendering without calling
// useSession() in every leaf component.

import { create } from 'zustand'

export type AuthUser = {
  id:    string
  email: string
  role:  string
  name?: string | null
}

type AuthState = {
  user:      AuthUser | null
  isLoading: boolean
  setUser:   (user: AuthUser | null) => void
  setLoading:(loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  isLoading: true,
  setUser:   (user) => set({ user, isLoading: false }),
  setLoading:(loading) => set({ isLoading: loading }),
}))

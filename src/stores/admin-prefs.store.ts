// Admin preferences store — persists UI preferences for the admin team.
// Currently manages dark mode only.
//
// design-system-v1.md §18:
//   - Dark mode is admin-only; consumer UI is light-mode-only in Phase 1.
//   - Preference persisted to localStorage.
//   - System prefers-color-scheme used as default when no stored value.
//   - data-theme="dark" set on <html> by the admin layout via useEffect.
//
// Initialisation: reads localStorage and system preference on first access.
// The store is lazy-initialised so SSR does not read localStorage.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AdminPrefsState = {
  isDark:     boolean
  toggleDark: () => void
  setDark:    (dark: boolean) => void
}

const getSystemPreference = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useAdminPrefsStore = create<AdminPrefsState>()(
  persist(
    (set) => ({
      // Initialise from system preference; localStorage value overrides via persist.
      isDark:     getSystemPreference(),
      toggleDark: () => set((s) => ({ isDark: !s.isDark })),
      setDark:    (dark) => set({ isDark: dark }),
    }),
    {
      name:    'chow-here-admin-prefs',
      // Only persist isDark; toggleDark/setDark are functions, not state.
      partialize: (s) => ({ isDark: s.isDark }),
    },
  ),
)

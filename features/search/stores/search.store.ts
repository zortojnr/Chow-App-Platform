'use client'

// Search Zustand store — ephemeral UI state only.
// URL is the source of truth for active search queries.
// This store manages:
//   cityContext        — persisted city preference (mirrors chow-city cookie)
//   anonRecentSearches — anonymous user recent queries (authenticated users use API)
//
// Cookie sync: when cityContext changes, also set the chow-city cookie so
// server-rendered ISR pages pick up the preference on the next visit.
//
// Governed by: track-04-search-discovery.md §15.4, §3.4

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SearchStore {
  cityContext: string | null
  setCityContext: (city: string | null) => void
  anonRecentSearches: { query: string; location: string | null }[]
  addAnonRecentSearch: (query: string, location: string | null) => void
  clearAnonRecentSearches: () => void
}

export const useSearchStore = create<SearchStore>()(
  persist(
    (set, get) => ({
      cityContext: null,

      setCityContext: (city) => {
        set({ cityContext: city })
        // Mirror to chow-city cookie so server-side ISR reads the preference
        if (typeof document !== 'undefined') {
          if (city) {
            document.cookie = `chow-city=${encodeURIComponent(city)}; path=/; max-age=7776000; SameSite=Lax`
          } else {
            document.cookie = 'chow-city=; path=/; max-age=0; SameSite=Lax'
          }
        }
      },

      anonRecentSearches: [],

      addAnonRecentSearch: (query, location) => {
        const prev = get().anonRecentSearches
        const updated = [
          { query, location },
          ...prev.filter((r) => r.query.toLowerCase() !== query.toLowerCase()),
        ].slice(0, 5)
        set({ anonRecentSearches: updated })
      },

      clearAnonRecentSearches: () => set({ anonRecentSearches: [] }),
    }),
    {
      name: 'chow-search',
      partialize: (s) => ({
        cityContext: s.cityContext,
        anonRecentSearches: s.anonRecentSearches,
      }),
    },
  ),
)

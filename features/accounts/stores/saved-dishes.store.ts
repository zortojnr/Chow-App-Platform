'use client'

// Saved Dishes Store — Track 5 §5.2, track-04 §7.5
//
// Maps restaurantDishId -> SavedDish.id for the authenticated user, so every
// SearchRestaurantCard can show the correct bookmark state (key presence) and
// the unsave call (needs SavedDish.id) works even for dishes saved in a
// previous session. Hydrated once per session from
// GET /api/v1/users/saved-dishes?idsOnly=true.
//
// Governed by: track-05-user-accounts.md §5.2

import { create } from 'zustand'

interface SavedDishesStore {
  savedDishMap: Map<string, string> // restaurantDishId -> savedDishId
  isHydrated: boolean
  hydrationPromise: Promise<void> | null
  hydrate: () => Promise<void>
  markSaved: (restaurantDishId: string, savedDishId: string) => void
  markUnsaved: (restaurantDishId: string) => void
  reset: () => void
}

export const useSavedDishesStore = create<SavedDishesStore>((set, get) => ({
  savedDishMap: new Map(),
  isHydrated: false,
  hydrationPromise: null,

  hydrate: async () => {
    const state = get()
    if (state.isHydrated) return
    if (state.hydrationPromise) return state.hydrationPromise

    const promise = (async () => {
      try {
        const res = await fetch('/api/v1/users/saved-dishes?idsOnly=true')
        if (!res.ok) return
        const json = await res.json()
        const entries: { restaurantDishId: string; savedDishId: string }[] =
          Array.isArray(json?.data?.entries) ? json.data.entries : []
        const map = new Map(entries.map((e) => [e.restaurantDishId, e.savedDishId]))
        set({ savedDishMap: map, isHydrated: true })
      } catch {
        // Silent degradation — bookmark states default to unsaved.
      }
    })()

    set({ hydrationPromise: promise })
    return promise
  },

  markSaved: (restaurantDishId, savedDishId) => {
    set((state) => {
      const next = new Map(state.savedDishMap)
      next.set(restaurantDishId, savedDishId)
      return { savedDishMap: next }
    })
  },

  markUnsaved: (restaurantDishId) => {
    set((state) => {
      const next = new Map(state.savedDishMap)
      next.delete(restaurantDishId)
      return { savedDishMap: next }
    })
  },

  reset: () => set({ savedDishMap: new Map(), isHydrated: false, hydrationPromise: null }),
}))

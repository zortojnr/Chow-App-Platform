'use client'

// Location Store — Track 7
//
// Zustand store for user GPS state.
// Coordinates are held in memory only — never written to localStorage,
// sessionStorage (except as session-scoped consent flag), or the server.
//
// Privacy contract (track-07 §6):
//   - coordinates exist in React/Zustand memory only
//   - consent flag ('chow-here-location-consent') stored in sessionStorage
//     so re-prompting doesn't happen within the same browsing session
//   - NO coordinates ever leave the client
//
// Governed by: track-07-navigation-location.md §6

import { create } from 'zustand'

export type LocationPermission = 'idle' | 'granted' | 'denied' | 'unavailable'

export type LocationState = {
  permission: LocationPermission
  latitude: number | null
  longitude: number | null
  accuracy: number | null       // metres
  // Actions
  setGranted: (lat: number, lng: number, accuracy: number) => void
  setDenied: () => void
  setUnavailable: () => void
  clearLocation: () => void
}

export const useLocationStore = create<LocationState>((set) => ({
  permission: 'idle',
  latitude: null,
  longitude: null,
  accuracy: null,

  setGranted(lat, lng, accuracy) {
    set({ permission: 'granted', latitude: lat, longitude: lng, accuracy })
  },

  setDenied() {
    set({ permission: 'denied', latitude: null, longitude: null, accuracy: null })
    sessionStorage.setItem('chow-here-location-consent', 'denied')
  },

  setUnavailable() {
    set({ permission: 'unavailable', latitude: null, longitude: null, accuracy: null })
  },

  clearLocation() {
    set({ permission: 'idle', latitude: null, longitude: null, accuracy: null })
    sessionStorage.removeItem('chow-here-location-consent')
  },
}))

// Whether to suppress the location prompt this session (user already denied)
export function locationPromptSuppressed(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('chow-here-location-consent') === 'denied'
}

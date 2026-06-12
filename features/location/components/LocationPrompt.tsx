'use client'

// LocationPrompt — Track 7
//
// Inline GPS permission banner shown on the search page.
// Appears only when:
//   - Geolocation API is available
//   - User hasn't already denied this session (locationPromptSuppressed())
//   - Location permission is 'idle'
//
// Not a modal — a slim, dismissible bar below the search header.
// Design: amber-50 background, MapPin icon, amber-500 action text.
// Governed by: track-07-navigation-location.md §7.1

import { useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { useUserLocation } from '../hooks/useUserLocation'
import { locationPromptSuppressed, useLocationStore } from '../stores/location.store'

export function LocationPrompt() {
  const { permission, requestLocation } = useUserLocation()
  const setDenied = useLocationStore((s) => s.setDenied)
  const [dismissed, setDismissed] = useState(false)

  const geolocationAvailable =
    typeof navigator !== 'undefined' && !!navigator.geolocation

  const shouldShow =
    !dismissed &&
    permission === 'idle' &&
    geolocationAvailable &&
    !locationPromptSuppressed()

  if (!shouldShow) return null

  return (
    <div
      role="region"
      aria-label="Location sharing"
      className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-sm"
    >
      <MapPin size={15} className="shrink-0 text-amber-500" aria-hidden="true" />
      <span className="flex-1 text-neutral-700">
        Share your location to find the closest restaurants
      </span>
      <button
        onClick={requestLocation}
        className="shrink-0 font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
      >
        Allow
      </button>
      <button
        onClick={() => { setDismissed(true); setDenied() }}
        aria-label="Dismiss location prompt"
        className="shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

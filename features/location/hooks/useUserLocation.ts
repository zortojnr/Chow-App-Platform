'use client'

// useUserLocation — Track 7
//
// Requests the Geolocation API and writes coordinates into the location store.
// One-shot: calls getCurrentPosition once. For continuous tracking on the
// restaurant profile page, use useRestaurantTracking instead.
//
// Privacy: coordinates live only in the Zustand store (memory).
// They are never sent to the server or written to storage.

import { useCallback } from 'react'
import { useLocationStore } from '../stores/location.store'

export function useUserLocation() {
  const { permission, latitude, longitude, setGranted, setDenied, setUnavailable } =
    useLocationStore()

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setUnavailable()
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGranted(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setDenied()
        } else {
          setUnavailable()
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  }, [setGranted, setDenied, setUnavailable])

  return {
    permission,
    latitude,
    longitude,
    requestLocation,
    hasLocation: permission === 'granted' && latitude !== null && longitude !== null,
  }
}

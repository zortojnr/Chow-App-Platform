'use client'

// useRestaurantTracking — Track 7
//
// Continuous GPS tracking for the restaurant profile page.
// Uses watchPosition to update distance in real time and detect arrival.
//
// Privacy: coordinates are only in memory. They are never sent to the server.
// The watch is cleared when the component unmounts.
//
// Governed by: track-07-navigation-location.md §8

import { useState, useEffect, useRef } from 'react'
import { haversineKm, ARRIVAL_THRESHOLD_KM, formatDistance } from '@/lib/geo'

type TrackingState = {
  distanceKm: number | null
  formattedDistance: string | null
  hasArrived: boolean
  isTracking: boolean
}

export function useRestaurantTracking(
  restaurantLat: number | null,
  restaurantLng: number | null,
): TrackingState {
  const [state, setState] = useState<TrackingState>({
    distanceKm: null,
    formattedDistance: null,
    hasArrived: false,
    isTracking: false,
  })

  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (
      restaurantLat === null ||
      restaurantLng === null ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      return
    }

    setState((s) => ({ ...s, isTracking: true }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const km = haversineKm(
          pos.coords.latitude,
          pos.coords.longitude,
          restaurantLat,
          restaurantLng,
        )
        setState({
          distanceKm: km,
          formattedDistance: formatDistance(km),
          hasArrived: km < ARRIVAL_THRESHOLD_KM,
          isTracking: true,
        })
      },
      () => {
        setState((s) => ({ ...s, isTracking: false }))
      },
      { enableHighAccuracy: true, maximumAge: 15_000 },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [restaurantLat, restaurantLng])

  return state
}

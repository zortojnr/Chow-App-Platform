'use client'

// RestaurantTrackingSection — Track 7
//
// Client island that shows the ArrivalBanner when the user is within 150 m.
// Uses useRestaurantTracking (continuous GPS watchPosition).
// Only renders when GPS has been granted (LocationPermpt is on the search page).
//
// Governed by: track-07-navigation-location.md §8

import { ArrivalBanner } from 'features/location/components/ArrivalBanner'
import { useRestaurantTracking } from 'features/location/hooks/useRestaurantTracking'

interface Props {
  restaurantName: string
  latitude: number
  longitude: number
}

export function RestaurantTrackingSection({ restaurantName, latitude, longitude }: Props) {
  const { hasArrived } = useRestaurantTracking(latitude, longitude)

  return (
    <ArrivalBanner restaurantName={restaurantName} hasArrived={hasArrived} />
  )
}

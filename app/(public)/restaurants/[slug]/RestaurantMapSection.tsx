'use client'

// RestaurantMapSection — client wrapper for Track 7 map + tracking.
//
// `ssr: false` with next/dynamic is only allowed in Client Components.
// This wrapper owns both dynamic imports so the Server Component page
// never calls dynamic() directly.

import dynamic from 'next/dynamic'

const RestaurantMap = dynamic(
  () => import('features/restaurants/components/RestaurantMap').then((m) => m.RestaurantMap),
  { ssr: false, loading: () => <div className="w-full h-64 rounded-xl bg-neutral-100 animate-pulse" /> },
)

const RestaurantTrackingSection = dynamic(
  () => import('./RestaurantTrackingSection').then((m) => m.RestaurantTrackingSection),
  { ssr: false },
)

interface Props {
  restaurantName: string
  latitude: number
  longitude: number
}

export function RestaurantMapSection({ restaurantName, latitude, longitude }: Props) {
  return (
    <>
      <RestaurantMap
        latitude={latitude}
        longitude={longitude}
        restaurantName={restaurantName}
      />
      <RestaurantTrackingSection
        restaurantName={restaurantName}
        latitude={latitude}
        longitude={longitude}
      />
    </>
  )
}

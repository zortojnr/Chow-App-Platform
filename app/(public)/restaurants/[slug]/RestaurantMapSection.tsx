'use client'

// RestaurantMapSection — client wrapper for Track 7 map + tracking.
//
// `ssr: false` with next/dynamic is only allowed in Client Components.
// This wrapper owns all dynamic imports so the Server Component page
// never calls dynamic() directly.
//
// When coordinates (latitude/longitude) are provided: shows the MapLibre map.
// When only an address is provided: geocodes via Nominatim, then shows MapLibre.

import dynamic from 'next/dynamic'

const RestaurantMap = dynamic(
  () => import('features/restaurants/components/RestaurantMap').then((m) => m.RestaurantMap),
  { ssr: false, loading: () => <div className="w-full h-56 rounded-xl bg-neutral-100 animate-pulse" /> },
)

const MapFromAddress = dynamic(
  () => import('features/restaurants/components/RestaurantMap').then((m) => m.MapFromAddress),
  { ssr: false, loading: () => <div className="w-full h-56 rounded-xl bg-neutral-100 animate-pulse" /> },
)

const RestaurantTrackingSection = dynamic(
  () => import('./RestaurantTrackingSection').then((m) => m.RestaurantTrackingSection),
  { ssr: false },
)

interface Props {
  restaurantName: string
  address: string
  city: string
  latitude: number | null
  longitude: number | null
}

export function RestaurantMapSection({ restaurantName, address, city, latitude, longitude }: Props) {
  const hasCoords = latitude !== null && longitude !== null

  return (
    <>
      {hasCoords ? (
        <RestaurantMap
          latitude={latitude!}
          longitude={longitude!}
          restaurantName={restaurantName}
        />
      ) : (
        <MapFromAddress
          address={address}
          city={city}
          restaurantName={restaurantName}
        />
      )}

      {hasCoords && (
        <RestaurantTrackingSection
          restaurantName={restaurantName}
          latitude={latitude!}
          longitude={longitude!}
        />
      )}
    </>
  )
}

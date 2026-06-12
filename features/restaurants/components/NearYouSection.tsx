'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Navigation, UtensilsCrossed } from 'lucide-react'
import { useLocationStore } from 'features/location/stores/location.store'
import { useUserLocation } from 'features/location/hooks/useUserLocation'
import { formatDistance } from '@/lib/geo'

type NearbyRestaurant = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  cuisineTypes: string[]
  thumbnailUrl: string | null
  distanceKm: number
  formattedDistance: string
}

interface NearYouSectionProps {
  limit?: number
}

export function NearYouSection({ limit = 6 }: NearYouSectionProps) {
  const { permission, latitude, longitude } = useLocationStore()
  const { requestLocation } = useUserLocation()
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([])
  const [fetching, setFetching] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const didRequest = useRef(false)

  // Auto-request location on first mount
  useEffect(() => {
    if (permission === 'idle' && !didRequest.current) {
      didRequest.current = true
      setRequesting(true)
      requestLocation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear requesting spinner once the store resolves
  useEffect(() => {
    if (permission !== 'idle') setRequesting(false)
  }, [permission])

  // Fetch nearby restaurants once GPS is granted
  useEffect(() => {
    if (permission !== 'granted' || latitude === null || longitude === null) return
    setFetching(true)
    fetch(`/api/v1/restaurants/nearby?lat=${latitude}&lng=${longitude}&limit=${limit}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setRestaurants(json.data.restaurants) })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [permission, latitude, longitude, limit])

  // Waiting for the user to respond to the browser permission dialog
  if (requesting || (permission === 'idle')) {
    return (
      <section aria-labelledby="near-you-heading" className="px-4 md:px-0">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="near-you-heading"
            className="font-display text-xl md:text-2xl font-semibold text-neutral-900"
          >
            Near You
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-none md:grid md:grid-cols-3 md:overflow-visible">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shrink-0 w-56 md:w-auto rounded-xl bg-neutral-100 animate-pulse h-48" />
          ))}
        </div>
      </section>
    )
  }

  // GPS denied or unavailable — hide the section entirely
  if (permission === 'denied' || permission === 'unavailable') return null

  // Fetching restaurant data
  if (fetching) {
    return (
      <section aria-labelledby="near-you-heading" className="px-4 md:px-0">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="near-you-heading"
            className="font-display text-xl md:text-2xl font-semibold text-neutral-900"
          >
            Near You
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-none md:grid md:grid-cols-3 md:overflow-visible">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shrink-0 w-56 md:w-auto rounded-xl bg-neutral-100 animate-pulse h-48" />
          ))}
        </div>
      </section>
    )
  }

  if (restaurants.length === 0) return null

  return (
    <section aria-labelledby="near-you-heading">
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <h2
          id="near-you-heading"
          className="font-display text-xl md:text-2xl font-semibold text-neutral-900"
        >
          Near You
        </h2>
        <Link
          href="/restaurants"
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
        >
          See all
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-4 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
        {restaurants.map((r) => (
          <Link
            key={r.id}
            href={`/restaurants/${r.slug}`}
            className="shrink-0 w-56 md:w-auto block rounded-xl overflow-hidden bg-neutral-0 shadow-sm hover:shadow transition-all duration-normal hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-brand group"
          >
            <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
              {r.thumbnailUrl ? (
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex items-center justify-center h-full" aria-hidden="true">
                  <UtensilsCrossed size={28} strokeWidth={1.5} className="text-neutral-300" />
                </div>
              )}
            </div>

            <div className="p-3">
              <p className="font-display font-semibold text-neutral-900 text-base leading-snug line-clamp-1">
                {r.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Navigation size={11} className="shrink-0 text-amber-500" aria-hidden="true" />
                <span className="text-xs text-neutral-500">{r.formattedDistance ?? formatDistance(r.distanceKm)}</span>
                {r.area && <span className="text-xs text-neutral-400">· {r.area}</span>}
              </div>
              {r.cuisineTypes.length > 0 && (
                <p className="text-xs text-amber-600 mt-1 line-clamp-1">
                  {r.cuisineTypes.slice(0, 2).join(' · ')}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

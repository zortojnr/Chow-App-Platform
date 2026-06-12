'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navigation, MapPin } from 'lucide-react'
import { useLocationStore } from 'features/location/stores/location.store'
import { useUserLocation } from 'features/location/hooks/useUserLocation'
import { formatDistance } from '@/lib/geo'

// ─── Abuja areas available for manual selection ───────────────
const ABUJA_AREAS = [
  'Wuse 2', 'Maitama', 'Garki', 'Asokoro', 'Jabi',
  'Central Area', 'Area 11', 'Gwarinpa', 'Life Camp', 'Utako', 'Wuse',
]

// ─── Price display ────────────────────────────────────────────
const PRICE: Record<string, string> = { BUDGET: '₦', MID: '₦₦', UPSCALE: '₦₦₦' }

// ─── Stable gradient per restaurant name initial ─────────────
const GRADIENTS = [
  'from-amber-400 to-orange-500',
  'from-green-400 to-emerald-600',
  'from-rose-400 to-pink-600',
  'from-sky-400 to-blue-600',
  'from-violet-400 to-purple-600',
  'from-teal-400 to-cyan-600',
  'from-yellow-400 to-amber-500',
  'from-indigo-400 to-blue-500',
]
function gradientFor(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

// ─── Types ────────────────────────────────────────────────────
type CardRestaurant = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  cuisineTypes: string[]
  thumbnailUrl: string | null
  priceRange: string
  distanceKm?: number
  formattedDistance?: string
}

interface NearYouSectionProps {
  limit?: number
}

// ─── Skeleton row ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-none md:grid md:grid-cols-3 md:overflow-visible">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="shrink-0 w-56 md:w-auto rounded-xl bg-neutral-100 animate-pulse h-52" />
      ))}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────
function RestaurantCard({ r }: { r: CardRestaurant }) {
  const gradient = gradientFor(r.name)
  const initial  = r.name[0]?.toUpperCase() ?? '?'
  const price    = PRICE[r.priceRange] ?? '₦₦'

  return (
    <Link
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
          <div className={`flex items-center justify-center h-full bg-gradient-to-br ${gradient}`} aria-hidden="true">
            <span className="text-4xl font-display font-bold text-white/90">{initial}</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="font-display font-semibold text-neutral-900 text-base leading-snug line-clamp-1">
          {r.name}
        </p>

        <div className="flex items-center justify-between mt-1">
          {r.formattedDistance != null ? (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <Navigation size={11} className="shrink-0 text-amber-500" aria-hidden="true" />
              {r.formattedDistance}
            </span>
          ) : r.area ? (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <MapPin size={11} className="shrink-0 text-neutral-400" aria-hidden="true" />
              {r.area}
            </span>
          ) : (
            <span className="text-xs text-neutral-400">{r.city}</span>
          )}
          <span className="text-xs font-semibold text-amber-600">{price}</span>
        </div>

        {r.cuisineTypes.length > 0 && (
          <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
            {r.cuisineTypes.slice(0, 2).join(' · ')}
          </p>
        )}
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────
export function NearYouSection({ limit = 6 }: NearYouSectionProps) {
  const { permission, latitude, longitude } = useLocationStore()
  const { requestLocation } = useUserLocation()

  const [restaurants, setRestaurants] = useState<CardRestaurant[]>([])
  const [fetching,   setFetching]   = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [selectedArea, setSelectedArea] = useState<string | null>(null)

  // Clear requesting spinner once the store resolves
  useEffect(() => {
    if (permission !== 'idle') setRequesting(false)
  }, [permission])

  // Fetch by GPS proximity when granted and coordinates exist
  useEffect(() => {
    if (permission !== 'granted' || latitude === null || longitude === null) return

    setFetching(true)
    fetch(`/api/v1/restaurants/nearby?lat=${latitude}&lng=${longitude}&limit=${limit}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data.restaurants.length > 0) {
          setRestaurants(json.data.restaurants)
        } else {
          // No geocoded restaurants yet — fall back to area-based
          fetchByArea(selectedArea)
        }
      })
      .catch(() => fetchByArea(selectedArea))
      .finally(() => setFetching(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, latitude, longitude])

  // Fetch by selected area (manual picker or fallback)
  function fetchByArea(area: string | null) {
    const params = new URLSearchParams({ city: 'Abuja', limit: String(limit) })
    if (area) params.set('area', area)
    setFetching(true)
    fetch(`/api/v1/restaurants?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setRestaurants(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setFetching(false))
  }

  // When area chip is tapped — re-fetch
  function handleAreaSelect(area: string) {
    const next = area === selectedArea ? null : area
    setSelectedArea(next)
    fetchByArea(next)
  }

  // ── Denied / unavailable: show manual area picker immediately ──
  if (permission === 'denied' || permission === 'unavailable') {
    return (
      <section aria-labelledby="near-you-heading">
        <div className="flex items-center justify-between mb-3 px-4 md:px-0">
          <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900">
            Near You
          </h2>
          <Link href="/restaurants" className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand">
            See all
          </Link>
        </div>

        {/* Area chip picker */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 px-4 md:px-0 mb-4">
          {ABUJA_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => handleAreaSelect(area)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand ${
                selectedArea === area
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-neutral-0 border-neutral-200 text-neutral-600 hover:border-amber-300 hover:text-amber-700'
              }`}
            >
              {area}
            </button>
          ))}
        </div>

        {fetching ? (
          <SkeletonRow />
        ) : restaurants.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-4 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
            {restaurants.map((r) => <RestaurantCard key={r.id} r={r} />)}
          </div>
        ) : (
          <div className="px-4 md:px-0">
            <p className="text-sm text-neutral-400">Select an area above to browse restaurants.</p>
          </div>
        )}
      </section>
    )
  }

  // ── Idle: show the location CTA button ────────────────────
  if (permission === 'idle') {
    return (
      <section aria-labelledby="near-you-heading" className="px-4 md:px-0">
        <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900 mb-4">
          Near You
        </h2>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-8 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center" aria-hidden="true">
            <Navigation size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="font-display font-semibold text-neutral-800 text-base">Find restaurants near you</p>
            <p className="text-sm text-neutral-500 mt-0.5">Allow location access to see what&apos;s close by</p>
          </div>
          <button
            type="button"
            onClick={() => { setRequesting(true); requestLocation() }}
            className="px-5 py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:bg-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
          >
            Use my location
          </button>
        </div>
      </section>
    )
  }

  // ── Waiting for browser permission dialog ──────────────────
  if (requesting) {
    return (
      <section aria-labelledby="near-you-heading" className="px-4 md:px-0">
        <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900 mb-4">
          Near You
        </h2>
        <SkeletonRow />
      </section>
    )
  }

  // ── GPS granted — loading results ──────────────────────────
  if (fetching) {
    return (
      <section aria-labelledby="near-you-heading" className="px-4 md:px-0">
        <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900 mb-4">
          Near You
        </h2>
        <SkeletonRow />
      </section>
    )
  }

  if (restaurants.length === 0) return null

  // ── Results ────────────────────────────────────────────────
  const hasDistances = restaurants.some((r) => r.formattedDistance != null)

  return (
    <section aria-labelledby="near-you-heading">
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900">
          {hasDistances ? 'Near You' : 'In Abuja'}
        </h2>
        <Link
          href="/restaurants"
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
        >
          See all
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-4 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
        {restaurants.map((r) => <RestaurantCard key={r.id} r={r} />)}
      </div>
    </section>
  )
}

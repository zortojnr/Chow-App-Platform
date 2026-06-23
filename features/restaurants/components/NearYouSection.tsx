'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navigation, MapPin, Utensils } from 'lucide-react'
import { useLocationStore } from 'features/location/stores/location.store'
import { useUserLocation } from 'features/location/hooks/useUserLocation'
import { DistanceBadge } from 'features/location/components/DistanceBadge'
import type { DishCategory } from '@prisma/client'

// ─── Abuja areas ──────────────────────────────────────────────
const ABUJA_AREAS = [
  'Wuse 2', 'Maitama', 'Garki', 'Asokoro', 'Jabi',
  'Central Area', 'Area 11', 'Gwarinpa', 'Life Camp', 'Utako', 'Wuse',
]

// ─── Price display ────────────────────────────────────────────
const PRICE: Record<string, string> = { BUDGET: '₦', MID: '₦₦', UPSCALE: '₦₦₦' }

// ─── Category colour dots ─────────────────────────────────────
const CATEGORY_COLORS: Partial<Record<DishCategory, string>> = {
  SOUPS:       'bg-amber-400',
  RICE_DISHES: 'bg-orange-400',
  PROTEIN:     'bg-red-400',
  STREET_FOOD: 'bg-yellow-400',
  SNACKS:      'bg-lime-400',
  SWALLOW:     'bg-emerald-400',
  BREAKFAST:   'bg-sky-400',
  DRINKS:      'bg-purple-400',
}

// ─── Stable gradient per dish name initial ────────────────────
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
type DishDiscoveryResult = {
  dishId: string
  canonicalName: string
  category: DishCategory
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  area: string | null
  priceRange: string
  thumbnailUrl: string | null
  distanceKm: number | null
}

interface NearYouSectionProps {
  limit?: number
}

// ─── Skeleton ─────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-none md:grid md:grid-cols-4 md:overflow-visible">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="shrink-0 w-44 md:w-auto rounded-xl bg-neutral-100 animate-pulse h-48" />
      ))}
    </div>
  )
}

// ─── Dish Card ────────────────────────────────────────────────
function DishNearCard({ item }: { item: DishDiscoveryResult }) {
  const gradient = gradientFor(item.canonicalName)
  const dot      = CATEGORY_COLORS[item.category] ?? 'bg-neutral-400'
  const price    = PRICE[item.priceRange] ?? '₦₦'
  const initial  = item.canonicalName[0]?.toUpperCase() ?? '?'

  return (
    <Link
      href={`/restaurants/${item.restaurantSlug}`}
      className="shrink-0 w-44 md:w-auto block rounded-xl overflow-hidden bg-neutral-0 shadow-sm hover:shadow transition-all duration-normal hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-brand group"
    >
      {/* Thumbnail / gradient placeholder */}
      <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className={`flex items-center justify-center h-full bg-gradient-to-br ${gradient}`}
            aria-hidden="true"
          >
            <span className="text-3xl font-display font-bold text-white/90">{initial}</span>
          </div>
        )}

        {/* Category dot */}
        <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white`} aria-hidden="true" />
      </div>

      <div className="p-3">
        {/* Dish name */}
        <p className="font-display font-semibold text-neutral-900 text-sm leading-snug line-clamp-1">
          {item.canonicalName}
        </p>

        {/* Restaurant */}
        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
          @ {item.restaurantName}
        </p>

        {/* Area/distance + price */}
        <div className="flex items-center justify-between mt-1.5">
          {item.distanceKm !== null ? (
            <DistanceBadge distanceKm={item.distanceKm} />
          ) : item.area ? (
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <MapPin size={10} className="shrink-0" aria-hidden="true" />
              {item.area}
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs font-semibold text-amber-600">{price}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────
export function NearYouSection({ limit = 8 }: NearYouSectionProps) {
  const { permission, latitude, longitude } = useLocationStore()
  const { requestLocation } = useUserLocation()

  const [dishes,       setDishes]      = useState<DishDiscoveryResult[]>([])
  const [fetching,     setFetching]    = useState(false)
  const [requesting,   setRequesting]  = useState(false)
  const [selectedArea, setSelectedArea] = useState<string | null>(null)

  // Clear requesting spinner once the store resolves
  useEffect(() => {
    if (permission !== 'idle') setRequesting(false)
  }, [permission])

  // When GPS is granted, fetch sorted by real distance from the user
  useEffect(() => {
    if (permission !== 'granted' || latitude === null || longitude === null) return
    fetchByArea(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, latitude, longitude])

  function fetchByArea(area: string | null) {
    const params = new URLSearchParams({ city: 'Abuja', limit: String(limit) })
    if (area) params.set('area', area)
    if (permission === 'granted' && latitude !== null && longitude !== null) {
      params.set('lat', String(latitude))
      params.set('lng', String(longitude))
    }
    setFetching(true)
    fetch(`/api/v1/dishes/discover?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDishes(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setFetching(false))
  }

  function handleAreaSelect(area: string) {
    const next = area === selectedArea ? null : area
    setSelectedArea(next)
    fetchByArea(next)
  }

  // ── Denied / unavailable: area picker ─────────────────────
  if (permission === 'denied' || permission === 'unavailable') {
    return (
      <section aria-labelledby="near-you-heading">
        <div className="flex items-center justify-between mb-3 px-4 md:px-0">
          <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900">
            Dishes Near You
          </h2>
          <Link
            href="/search"
            className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
          >
            Search all
          </Link>
        </div>

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
        ) : dishes.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-4 md:px-0 md:grid md:grid-cols-4 md:overflow-visible">
            {dishes.map((d) => <DishNearCard key={d.dishId + d.restaurantId} item={d} />)}
          </div>
        ) : (
          <div className="px-4 md:px-0">
            <p className="text-sm text-neutral-400">Select an area to see what&apos;s being served.</p>
          </div>
        )}
      </section>
    )
  }

  // ── Idle: location CTA ─────────────────────────────────────
  if (permission === 'idle') {
    return (
      <section aria-labelledby="near-you-heading" className="px-4 md:px-0">
        <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900 mb-4">
          Dishes Near You
        </h2>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-8 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center" aria-hidden="true">
            <Navigation size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="font-display font-semibold text-neutral-800 text-base">Find dishes near you</p>
            <p className="text-sm text-neutral-500 mt-0.5">See what&apos;s being served close by</p>
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
          Dishes Near You
        </h2>
        <SkeletonRow />
      </section>
    )
  }

  // ── GPS granted — loading ──────────────────────────────────
  if (fetching) {
    return (
      <section aria-labelledby="near-you-heading" className="px-4 md:px-0">
        <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900 mb-4">
          Dishes Near You
        </h2>
        <SkeletonRow />
      </section>
    )
  }

  if (dishes.length === 0) return null

  // ── Results ────────────────────────────────────────────────
  return (
    <section aria-labelledby="near-you-heading">
      <div className="flex items-center justify-between mb-1 px-4 md:px-0">
        <h2 id="near-you-heading" className="font-display text-xl md:text-2xl font-semibold text-neutral-900 flex items-center gap-2">
          <Utensils size={18} className="text-amber-500" aria-hidden="true" />
          Dishes Near You
        </h2>
        <Link
          href="/search"
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
        >
          Search all
        </Link>
      </div>
      <p className="text-xs text-neutral-400 mb-4 px-4 md:px-0">Sorted by distance from you</p>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-4 md:px-0 md:grid md:grid-cols-4 md:overflow-visible">
        {dishes.map((d) => <DishNearCard key={d.dishId + d.restaurantId} item={d} />)}
      </div>
    </section>
  )
}

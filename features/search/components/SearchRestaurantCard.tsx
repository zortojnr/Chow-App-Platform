'use client'

// SearchRestaurantCard — Step 14, §15.3
//
// Restaurant card for search-result contexts.
// Extends RestaurantCard with: bookmark icon, matched dish context, distance slot.
//
// Unlike RestaurantCard (Track 3), this component:
//   - Shows the matched dish name + availability below location
//   - Has a bookmark (save) button top-right (40×40px touch target, DS §8.5)
//   - Includes a `distance` prop slot (null in Phase 1, Phase 2 will populate)
//
// RestaurantCard is NOT modified — this is a new, separate component (§15.3).
//
// Hover: translateY(-2px), shadow, 200ms ease-out
// Photo hover: scale(1.03), 400ms ease-out
// Focus ring: shadow-brand
//
// Stagger entrance animation is applied by the parent SearchResults grid.

import Link from 'next/link'
import { MapPin, Bookmark, UtensilsCrossed } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { TrustBadge } from 'features/restaurants/components/TrustBadge'
import { cn } from '@/lib/utils'
import { AVAILABILITY_LABELS } from '../types/search.types'
import { useSavedDish } from '../hooks/useSavedDish'
import type { DishRestaurantResult } from '../types/search.types'

// ─── Price helpers ────────────────────────────────────────────

const PRICE_DISPLAY = { BUDGET: '₦', MID: '₦₦', UPSCALE: '₦₦₦' } as const
const PRICE_VARIANT = {
  BUDGET:  'price-budget',
  MID:     'price-mid',
  UPSCALE: 'price-upscale',
} as const satisfies Record<string, 'price-budget' | 'price-mid' | 'price-upscale'>

// ─── Component ───────────────────────────────────────────────

interface SearchRestaurantCardProps {
  restaurant: DishRestaurantResult
  distance?:  string    // Phase 2 — renders if provided, invisible if absent
  className?: string
  style?:     React.CSSProperties  // stagger animation delay applied by parent grid
}

export function SearchRestaurantCard({
  restaurant,
  distance,
  className,
  style,
}: SearchRestaurantCardProps) {
  const {
    name,
    slug,
    city,
    area,
    priceRange,
    confidenceScoreBand,
    thumbnailUrl,
    dishesServed,
    matchedDish,
    distanceKm,
  } = restaurant

  const { isSaved, isPending, toggle } = useSavedDish(matchedDish.restaurantDishId)

  const locationLabel     = area ? `${area} · ${city}` : city
  const availabilityLabel = AVAILABILITY_LABELS[matchedDish.availabilityStatus]
  const resolvedDistance  = distance ?? (distanceKm ? `${distanceKm} km` : undefined)

  return (
    <div
      className={cn(
        'group relative block bg-neutral-0 rounded-xl',
        'shadow-sm hover:shadow transition-all duration-normal ease-out',
        'hover:-translate-y-0.5',
        'overflow-hidden',
        className,
      )}
      style={style}
    >
      {/* ── Bookmark button — top right, 40×40 touch target ── */}
      <button
        onClick={toggle}
        disabled={isPending}
        className={cn(
          'absolute top-3 right-3 z-10',
          'w-10 h-10 rounded-full flex items-center justify-center',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:shadow-brand',
          isSaved
            ? 'bg-amber-500 text-neutral-0 hover:bg-amber-600'
            : 'bg-neutral-0 text-neutral-500 hover:bg-neutral-100',
        )}
        aria-label={`${isSaved ? 'Unsave' : 'Save'} ${matchedDish.nameAsServed ?? name} at ${name}`}
        aria-pressed={isSaved}
      >
        <Bookmark
          size={16}
          strokeWidth={isSaved ? 0 : 2}
          fill={isSaved ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </button>

      {/* ── Card link ─────────────────────────────────────── */}
      <Link
        href={`/restaurants/${slug}`}
        className="block focus-visible:outline-none focus-visible:shadow-brand"
        aria-label={`${name}, ${locationLabel}`}
      >
        {/* ── Photo ─────────────────────────────────────── */}
        <div className="relative overflow-hidden aspect-[4/3] rounded-t-xl bg-neutral-100">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex items-center justify-center h-full" aria-hidden="true">
              <UtensilsCrossed size={36} strokeWidth={1.5} className="text-neutral-300" />
            </div>
          )}

          {/* Trust badge — bottom-left overlay */}
          <div className="absolute bottom-3 left-3">
            <TrustBadge scoreBand={confidenceScoreBand} size="sm" />
          </div>
        </div>

        {/* ── Content ──────────────────────────────────── */}
        <div className="p-4">
          {/* Restaurant name */}
          <h3 className="font-display text-xl font-semibold text-neutral-900 leading-tight mb-1.5 line-clamp-1 pr-8">
            {name}
          </h3>

          {/* Location + optional distance */}
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin size={13} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
            <span className="text-sm text-neutral-600 truncate">{locationLabel}</span>
            {resolvedDistance && (
              <span className="text-xs text-neutral-400 shrink-0">· {resolvedDistance}</span>
            )}
          </div>

          {/* Matched dish context */}
          <div className="py-2 border-t border-neutral-100 mb-2">
            <p className="text-sm font-medium text-neutral-800 line-clamp-1">
              {matchedDish.nameAsServed ?? name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {availabilityLabel && (
                <span className="text-xs text-neutral-500">{availabilityLabel}</span>
              )}
              {matchedDish.price && (
                <span className="text-xs text-neutral-400">· ₦{matchedDish.price}</span>
              )}
            </div>
          </div>

          {/* Footer — price range + dish count */}
          <div className="flex items-center justify-between">
            <Badge variant={PRICE_VARIANT[priceRange]} aria-label={`Price range: ${priceRange.toLowerCase()}`}>
              {PRICE_DISPLAY[priceRange]}
            </Badge>
            <span className="text-xs font-medium text-neutral-500">
              {dishesServed} {dishesServed === 1 ? 'dish' : 'dishes'}
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────

export function SearchRestaurantCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('bg-neutral-0 shadow-sm rounded-xl overflow-hidden', className)}
      aria-busy="true"
      aria-label="Loading restaurant"
    >
      <Skeleton className="w-full aspect-[4/3] rounded-none rounded-t-xl" />
      <div className="p-4 space-y-2.5">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
        <div className="py-2 border-t border-neutral-100 space-y-1.5">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-7 rounded-full" />
          <Skeleton className="h-4 w-14 rounded" />
        </div>
      </div>
    </div>
  )
}

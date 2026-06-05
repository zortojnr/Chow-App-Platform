'use client'

// RestaurantCard — design-system-v1.md §10.3 (Restaurant Card Consumer), §13.2
//
// Used in the browse index and (Track 4) dish search results.
//
// Visual hierarchy (top to bottom):
//   1. Photo — 4:3 aspect, object-cover, rounded-t-xl top corners
//   2. TrustBadge — overlaid on photo, bottom-left
//   3. Restaurant name — Fraunces, text-2xl, semibold
//   4. Location — MapPin icon + "area · city", text-sm neutral-600
//   5. Cuisine type tags — neutral-100 pills
//   6. Footer: price range badge + dish count
//
// Hover: translateY(-2px), shadow → shadow-DEFAULT, 200ms ease-out (§7.4)
// Photo hover: subtle scale(1.03), 400ms ease-out (photography direction §App.B)
// Focus: shadow-brand ring (§8.3)
//
// Skeleton: photo block (4:3) + 2 text lines + tag row (§16.3)
//
// Accessibility: the whole card is a link; aria-label provides screen-reader context.

import Link from 'next/link'
import { MapPin, UtensilsCrossed } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { TrustBadge } from './TrustBadge'
import { cn } from '@/lib/utils'
import type { RestaurantCardResponse } from 'features/restaurants/services/restaurant-listing.service'

// ─── Price helpers ─────────────────────────────────────────────

const PRICE_DISPLAY = {
  BUDGET:  '₦',
  MID:     '₦₦',
  UPSCALE: '₦₦₦',
} as const

const PRICE_VARIANT = {
  BUDGET:  'price-budget',
  MID:     'price-mid',
  UPSCALE: 'price-upscale',
} as const satisfies Record<string, 'price-budget' | 'price-mid' | 'price-upscale'>

// ─── Component ─────────────────────────────────────────────────

interface RestaurantCardProps {
  restaurant: RestaurantCardResponse
  featured?:  boolean      // featured cards use radius-3xl (28px) for a more prominent treatment
  className?: string
}

export function RestaurantCard({
  restaurant,
  featured  = false,
  className,
}: RestaurantCardProps) {
  const {
    name,
    slug,
    city,
    area,
    priceRange,
    cuisineTypes,
    confidenceScoreBand,
    thumbnailUrl,
    dishCount,
  } = restaurant

  const locationLabel = area ? `${area} · ${city}` : city
  const cardRadius    = featured ? 'rounded-3xl' : 'rounded-xl'
  const photoRadius   = featured ? 'rounded-t-3xl' : 'rounded-t-xl'

  return (
    <Link
      href={`/restaurants/${slug}`}
      className={cn(
        'group block bg-neutral-0',
        cardRadius,
        // Resting: shadow-sm. Hover: shadow-DEFAULT + lift. §7.4 200ms ease-out.
        'shadow-sm hover:shadow transition-all duration-normal ease-out',
        'hover:-translate-y-0.5',
        // Focus ring — shadow-brand, never outline §8.3
        'focus-visible:outline-none focus-visible:shadow-brand',
        'overflow-hidden',
        className,
      )}
      aria-label={`${name}, ${locationLabel}`}
    >
      {/* ── Photo ─────────────────────────────────────────── */}
      <div
        className={cn(
          'relative overflow-hidden aspect-[4/3]',
          photoRadius,
          !thumbnailUrl && 'bg-neutral-100',
        )}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""                      // decorative — card aria-label covers context
            aria-hidden="true"
            className={cn(
              'w-full h-full object-cover',
              // Subtle zoom on card hover — §App.B photography direction
              'transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]',
            )}
            loading="lazy"
            decoding="async"
          />
        ) : (
          // Fallback when no verified photo exists
          <div className="flex items-center justify-center h-full" aria-hidden="true">
            <UtensilsCrossed size={40} strokeWidth={1.5} className="text-neutral-300" />
          </div>
        )}

        {/* TrustBadge — bottom-left overlay, §10.3 */}
        <div className="absolute bottom-3 left-3">
          <TrustBadge scoreBand={confidenceScoreBand} size="sm" />
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="p-5">
        {/* Restaurant name — Fraunces, text-2xl, semibold §3.4 */}
        <h3 className="font-display text-2xl font-semibold text-neutral-900 leading-tight mb-2 line-clamp-2">
          {name}
        </h3>

        {/* Location — MapPin 14px neutral-400, text-sm neutral-600 */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin
            size={14}
            strokeWidth={1.5}
            className="shrink-0 text-neutral-400"
            aria-hidden="true"
          />
          <span className="text-sm text-neutral-600 truncate">{locationLabel}</span>
        </div>

        {/* Cuisine type tags — neutral-100 pills, max 3 shown */}
        {cuisineTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cuisineTypes.slice(0, 3).map((cuisine) => (
              <Badge key={cuisine} variant="category">
                {cuisine}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer — price range + dish count */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
          <Badge variant={PRICE_VARIANT[priceRange]} aria-label={`Price range: ${priceRange.toLowerCase()}`}>
            {PRICE_DISPLAY[priceRange]}
          </Badge>
          <span className="text-xs font-medium text-neutral-500">
            {dishCount} {dishCount === 1 ? 'dish' : 'dishes'}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────
// Photo block (4:3) + name line + location line + tag row — §16.3

interface RestaurantCardSkeletonProps {
  featured?: boolean
}

export function RestaurantCardSkeleton({ featured = false }: RestaurantCardSkeletonProps) {
  const cardRadius  = featured ? 'rounded-3xl' : 'rounded-xl'
  const photoRadius = featured ? 'rounded-t-3xl' : 'rounded-t-xl'

  return (
    <div
      className={cn('bg-neutral-0 shadow-sm overflow-hidden', cardRadius)}
      aria-busy="true"
      aria-label="Loading restaurant"
    >
      {/* Photo skeleton */}
      <Skeleton className={cn('w-full aspect-[4/3] rounded-none', photoRadius)} />

      <div className="p-5 space-y-3">
        {/* Name */}
        <Skeleton className="h-7 w-3/4 rounded" />
        {/* Location */}
        <Skeleton className="h-4 w-1/2 rounded" />
        {/* Tags */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
          <Skeleton className="h-5 w-7 rounded-full" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}

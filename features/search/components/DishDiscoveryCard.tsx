'use client'

// DishDiscoveryCard — §4.5, §15.5.1
//
// Used in the Just Verified home page section.
// This section is dish-first: dish name is the headline, restaurant is context.
//
// Structure (horizontal): left side (dish name + restaurant + area) | right (availability badge)
// Full-width vertical stack on mobile (single col), 2-col tablet, 3-col desktop.
// Hover: translateY(-2px), shadow, 200ms ease-out.
// Skeleton: 2 text lines left + badge right.
//
// Accessibility: entire card is a link to the dish page.

import Link from 'next/link'
import { MapPin, ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AVAILABILITY_LABELS } from '../types/search.types'
import type { JustVerifiedResult } from '../types/search.types'

// ─── Component ───────────────────────────────────────────────

interface DishDiscoveryCardProps {
  dish:       JustVerifiedResult
  city?:      string | null
  className?: string
}

export function DishDiscoveryCard({ dish, city, className }: DishDiscoveryCardProps) {
  const href = city
    ? `/dishes/${dish.slug}?city=${encodeURIComponent(city)}`
    : `/dishes/${dish.slug}`

  const locationLabel = dish.area ? `${dish.area}, ${dish.city}` : dish.city
  const availabilityLabel = AVAILABILITY_LABELS[dish.availabilityStatus]
  const displayName = dish.nameAsServed && dish.nameAsServed !== dish.canonicalName
    ? dish.nameAsServed
    : dish.canonicalName

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-start gap-3 p-4 rounded-xl bg-neutral-0',
        'shadow-sm hover:shadow transition-all duration-normal ease-out',
        'hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:shadow-brand',
        className,
      )}
      aria-label={`${dish.canonicalName} at ${dish.restaurantName}`}
    >
      {/* Left: dish + restaurant info */}
      <div className="flex-1 min-w-0">
        {/* Dish name — hero text */}
        <p className="font-display text-lg font-semibold text-neutral-900 leading-tight mb-0.5 line-clamp-1">
          {displayName}
        </p>

        {/* Restaurant name */}
        <p className="text-sm font-medium text-neutral-700 line-clamp-1 mb-1">
          {dish.restaurantName}
        </p>

        {/* Location */}
        <div className="flex items-center gap-1">
          <MapPin size={12} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
          <span className="text-xs text-neutral-500 truncate">{locationLabel}</span>
        </div>
      </div>

      {/* Right: verified badge + availability */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 select-none"
          role="status"
          aria-label="Verified dish"
        >
          <ShieldCheck size={10} strokeWidth={2} aria-hidden="true" />
          Verified
        </span>
        {availabilityLabel && (
          <span className="text-xs text-neutral-400 text-right">{availabilityLabel}</span>
        )}
      </div>
    </Link>
  )
}

// ─── Skeleton ────────────────────────────────────────────────

export function DishDiscoveryCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl bg-neutral-0 shadow-sm',
        className,
      )}
      aria-busy="true"
      aria-label="Loading dish"
    >
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
      <div className="shrink-0">
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

'use client'

// DishDiscoveryTile — §4.5, §15.5.1
//
// Used in Popular Dishes and Trending This Week home page sections.
// Horizontal scroll on mobile, grid on tablet+.
//
// Structure: icon area + dish name + category badge + restaurant count
// Hover: translateY(-2px), shadow, 200ms ease-out (DS §7.4)
// Skeleton: 48px square block + 2 text lines + 1 tag row
//
// Accessibility: the whole tile is a link. aria-label provides context.

import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PopularDishResult, TrendingDishResult } from '../types/search.types'

// ─── Category icons (emoji-based, warm and Nigerian) ─────────

const CATEGORY_EMOJI: Record<string, string> = {
  RICE_DISHES:  '🍚',
  SOUPS:        '🥘',
  SWALLOW:      '🫙',
  STREET_FOOD:  '🥩',
  PROTEIN:      '🍖',
  BREAKFAST:    '🌅',
  DRINKS:       '🥤',
  SNACKS:       '🍿',
  DESSERTS:     '🍯',
}

// ─── Component ───────────────────────────────────────────────

interface DishDiscoveryTileProps {
  dish:       PopularDishResult | TrendingDishResult
  city?:      string | null
  className?: string
}

export function DishDiscoveryTile({ dish, city, className }: DishDiscoveryTileProps) {
  const href = city
    ? `/dishes/${dish.slug}?city=${encodeURIComponent(city)}`
    : `/dishes/${dish.slug}`

  const restaurantLabel = dish.restaurantCount === 1
    ? '1 restaurant'
    : `${dish.restaurantCount} restaurants`

  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-2.5 p-4 rounded-xl bg-neutral-0',
        'shadow-sm hover:shadow transition-all duration-normal ease-out',
        'hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:shadow-brand',
        // Fixed width on mobile (scroll), auto on tablet+
        'w-36 shrink-0 md:w-auto',
        className,
      )}
      aria-label={`${dish.canonicalName} — ${restaurantLabel}`}
    >
      {/* Category emoji icon */}
      <div
        className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-xl select-none"
        aria-hidden="true"
      >
        {CATEGORY_EMOJI[dish.category] ?? '🍽'}
      </div>

      {/* Dish name */}
      <p className="font-display text-base font-semibold text-neutral-900 leading-tight line-clamp-2">
        {dish.canonicalName}
      </p>

      {/* Restaurant count */}
      {dish.restaurantCount > 0 && (
        <p className="text-xs text-neutral-500 font-medium">
          {restaurantLabel}
        </p>
      )}
    </Link>
  )
}

// ─── Skeleton ────────────────────────────────────────────────

export function DishDiscoveryTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 p-4 rounded-xl bg-neutral-0 shadow-sm',
        'w-36 shrink-0 md:w-auto',
        className,
      )}
      aria-busy="true"
      aria-label="Loading dish"
    >
      <Skeleton className="w-10 h-10 rounded-lg" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
  )
}

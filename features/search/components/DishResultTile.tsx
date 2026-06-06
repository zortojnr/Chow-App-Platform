'use client'

// DishResultTile — Step 14, §15.2
//
// Dish match tile shown at the top of search results when a dish query matched.
// Structure: dish canonical name + category badge + restaurant count.
// Clicking navigates to /dishes/[dish-slug] (dish landing page).
//
// Accessibility: link with aria-label describing full context.
// Skeleton: name line + badge + count line.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DishSearchResult } from '../types/search.types'

// ─── Category display names ───────────────────────────────────

const CATEGORY_DISPLAY: Record<string, string> = {
  RICE_DISHES:  'Rice',
  SOUPS:        'Soups',
  SWALLOW:      'Swallow',
  STREET_FOOD:  'Street Food',
  PROTEIN:      'Protein',
  BREAKFAST:    'Breakfast',
  DRINKS:       'Drinks',
  SNACKS:       'Snacks',
  DESSERTS:     'Desserts',
}

// ─── Component ───────────────────────────────────────────────

interface DishResultTileProps {
  dish:       DishSearchResult
  city?:      string | null
  className?: string
}

export function DishResultTile({ dish, city, className }: DishResultTileProps) {
  const href = city
    ? `/dishes/${dish.slug}?city=${encodeURIComponent(city)}`
    : `/dishes/${dish.slug}`

  const restaurantLabel = dish.restaurantCount === 0
    ? 'No verified restaurants yet'
    : dish.restaurantCount === 1
      ? '1 verified restaurant'
      : `${dish.restaurantCount} verified restaurants`

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 px-4 py-3.5 rounded-xl bg-amber-50',
        'border border-amber-100 hover:border-amber-200',
        'transition-all duration-fast',
        'focus-visible:outline-none focus-visible:shadow-brand',
        className,
      )}
      aria-label={`${dish.canonicalName} — ${restaurantLabel}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-display text-lg font-semibold text-neutral-900 leading-tight">
            {dish.canonicalName}
          </p>
          <Badge variant="category">
            {CATEGORY_DISPLAY[dish.category] ?? dish.category}
          </Badge>
        </div>
        <p className="text-sm text-neutral-600">{restaurantLabel}</p>
      </div>

      <ChevronRight
        size={18}
        strokeWidth={2}
        className="shrink-0 text-amber-500 transition-transform duration-fast group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── Skeleton ────────────────────────────────────────────────

export function DishResultTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-3.5 rounded-xl bg-amber-50', className)}
      aria-busy="true"
    >
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-40 rounded" />
      </div>
    </div>
  )
}

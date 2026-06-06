'use client'

// SearchResults — Step 15, §15.2
//
// Displays results from the search API. Two sections:
//   1. Dish tiles (if dish matches exist) — at the top, amber tinted
//   2. Restaurant cards grid (main results)
//
// Loading: 8 SearchRestaurantCard skeletons (no delay — user expressed intent).
// Zero results: ZeroResults component.
// Stagger entrance animation (DS §7.5, §11.3): 40ms per card, max 6 in chain.
// Phase 2 map panel slot: outer div uses flex pattern (§12.2).

import { DishResultTile, DishResultTileSkeleton } from './DishResultTile'
import { SearchRestaurantCard, SearchRestaurantCardSkeleton } from './SearchRestaurantCard'
import { ZeroResults } from './ZeroResults'
import type { SearchResponse, DishRestaurantResult, RestaurantSearchResult } from '../types/search.types'
import { cn } from '@/lib/utils'

// ─── Component ───────────────────────────────────────────────

interface SearchResultsProps {
  response:  SearchResponse | null | undefined
  query:     string
  city?:     string | null
  isLoading: boolean
  isError:   boolean
  className?: string
}

export function SearchResults({
  response,
  query,
  city,
  isLoading,
  isError,
  className,
}: SearchResultsProps) {

  // Error state
  if (isError) {
    return (
      <ZeroResults
        query={query}
        city={city}
        timeoutFlag
        className={className}
      />
    )
  }

  // Loading: 8 skeletons immediately (0ms delay — §11.2)
  if (isLoading) {
    return (
      <div className={cn('flex gap-6', className)}>
        <div className="flex-1 min-w-0 space-y-4">
          {/* Dish tile skeleton */}
          <DishResultTileSkeleton />
          {/* Restaurant grid skeletons */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SearchRestaurantCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Zero results
  if (!response || response.isZeroResult) {
    return (
      <ZeroResults
        query={query}
        city={city}
        className={className}
      />
    )
  }

  const { dishes, restaurants } = response

  return (
    // Phase 2-compatible flex wrapper (§12.2) — grid takes all space when no map panel
    <div className={cn('flex gap-6', className)}>
      <div className="flex-1 min-w-0 space-y-4">

        {/* ── Dish tiles section ──────────────────────────── */}
        {dishes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider px-1">
              Dishes
            </p>
            {dishes.map((dish) => (
              <DishResultTile key={dish.dishId} dish={dish} city={city} />
            ))}
          </div>
        )}

        {/* ── Restaurant results grid ─────────────────────── */}
        {restaurants.length > 0 && (
          <div>
            {dishes.length > 0 && (
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3 px-1">
                Restaurants
              </p>
            )}
            <div
              className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              aria-label={`${restaurants.length} restaurant${restaurants.length === 1 ? '' : 's'}`}
            >
              {(restaurants as (DishRestaurantResult | RestaurantSearchResult)[]).map((r, index) => {
                // SearchRestaurantCard only works with DishRestaurantResult (has matchedDish)
                if (!('matchedDish' in r)) return null
                // Stagger entrance: 40ms per card, max 6 in chain — DS §7.5, §11.3
                const staggerMs = Math.min(index, 5) * 40
                return (
                  <SearchRestaurantCard
                    key={r.id}
                    restaurant={r}
                    className="card-enter"
                    style={{ animationDelay: `${staggerMs}ms` } as React.CSSProperties}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
      {/* Map panel slot — empty in Phase 1 (§12.2) */}
    </div>
  )
}

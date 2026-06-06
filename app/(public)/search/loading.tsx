// Search page loading skeleton — §11.2
//
// Shows while the search page route resolves.
// 8 SearchRestaurantCard skeletons (0ms delay — user expressed intent).

import { Skeleton } from '@/components/ui/skeleton'
import { SearchRestaurantCardSkeleton } from 'features/search/components/SearchRestaurantCard'

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Search header skeleton */}
      <div className="bg-neutral-0 border-b border-neutral-200 px-4 py-3 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-11 w-full rounded-[10px]" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* Query context skeleton */}
        <div className="mb-5 space-y-1.5">
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>

        {/* Dish tile skeleton */}
        <div className="mb-4">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>

        {/* Restaurant grid skeletons — 8 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SearchRestaurantCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

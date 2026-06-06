// Dish landing page loading skeleton — §11.2, §15.5.1

import { Skeleton } from '@/components/ui/skeleton'
import { SearchRestaurantCardSkeleton } from 'features/search/components/SearchRestaurantCard'

export default function DishLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 lg:py-12">
        {/* Heading skeleton */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 md:h-12 w-52 rounded" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-40 rounded" />
        </div>

        {/* City tabs skeleton */}
        <div className="flex gap-2 mb-8 overflow-x-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
          ))}
        </div>

        {/* Restaurant grid — 8 skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SearchRestaurantCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

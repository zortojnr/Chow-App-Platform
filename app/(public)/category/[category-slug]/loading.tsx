// Category browse loading skeleton — §11.2

import { Skeleton } from '@/components/ui/skeleton'
import { RestaurantCardSkeleton } from 'features/restaurants/components/RestaurantCard'

export default function CategoryLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 lg:py-12">
        {/* Heading skeleton */}
        <div className="mb-2">
          <Skeleton className="h-10 md:h-12 w-40 rounded" />
        </div>
        <Skeleton className="h-5 w-72 mb-6 rounded" />

        {/* City tabs skeleton */}
        <div className="flex gap-2 mb-8 overflow-x-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
          ))}
        </div>

        {/* Restaurant grid — 12 skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

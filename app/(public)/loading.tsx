// Home page loading skeleton — §11.2, §15.5.1
//
// Shows while the home page server component is loading.
// Matches the exact layout of page.tsx so no layout shift on hydration.

import { Skeleton } from '@/components/ui/skeleton'
import { DishDiscoveryTileSkeleton } from 'features/search/components/DishDiscoveryTile'
import { DishDiscoveryCardSkeleton } from 'features/search/components/DishDiscoveryCard'

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Hero skeleton */}
      <div className="bg-neutral-0 border-b border-neutral-100 px-4 pt-10 pb-8 md:pt-14 md:pb-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 space-y-3">
            <Skeleton className="h-12 md:h-14 w-48 mx-auto rounded-lg" />
            <Skeleton className="h-5 w-72 mx-auto rounded" />
          </div>
          <Skeleton className="h-12 lg:h-[52px] w-full rounded-[10px]" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 md:py-10 space-y-10 md:space-y-12">

        {/* Category chips skeleton */}
        <div className="md:px-6 lg:px-8 px-4">
          <Skeleton className="h-3 w-40 mb-3 rounded" />
          <div className="flex gap-2 overflow-x-hidden">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-20 rounded-full shrink-0" />
            ))}
          </div>
        </div>

        {/* Popular dishes skeleton */}
        <div className="md:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-4 px-4 md:px-0">
            <Skeleton className="h-7 w-44 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
          <div className="flex gap-3 overflow-x-hidden px-4 md:px-0 md:grid md:grid-cols-4 lg:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <DishDiscoveryTileSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Just verified skeleton */}
        <div className="md:px-6 lg:px-8">
          <div className="mb-1 px-4 md:px-0">
            <Skeleton className="h-7 w-36 rounded" />
          </div>
          <Skeleton className="h-4 w-52 mb-4 rounded px-4 md:px-0 mx-4 md:mx-0" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 md:px-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <DishDiscoveryCardSkeleton key={i} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

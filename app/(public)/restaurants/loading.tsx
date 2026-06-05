// Browse index loading skeleton — shown during route navigation.
// Matches the geometry of the browse page (§13.3):
//   Heading → filter tabs → 8 card skeletons in the grid

import { Skeleton } from '@/components/ui/skeleton'
import { RestaurantCardSkeleton } from 'features/restaurants/components'

export default function RestaurantBrowseLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">

      {/* Heading */}
      <Skeleton className="h-10 w-64 rounded mb-6" aria-hidden="true" />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Card grid — 8 skeletons */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5"
        aria-busy="true"
        aria-label="Loading restaurants"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// Profile page loading skeleton — shown during route navigation.
// Matches the geometry of the profile page sections (§13.7):
//   Hero block → Identity → Contact → Dishes (4 cards) → Gallery (3 cells)

import { Skeleton } from '@/components/ui/skeleton'
import {
  RestaurantHeroSkeleton,
  DishCardSkeleton,
  PhotoGallerySkeleton,
  RestaurantContactSectionSkeleton,
} from 'features/restaurants/components'

export default function RestaurantProfileLoading() {
  return (
    <article>
      <RestaurantHeroSkeleton />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10">

        {/* Identity skeleton */}
        <div className="space-y-3" aria-busy="true" aria-label="Loading restaurant identity">
          <Skeleton className="h-9 w-3/4 rounded" />
          <Skeleton className="h-[26px] w-[86px] rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-7 rounded-full" />
          </div>
        </div>

        {/* Contact skeleton */}
        <RestaurantContactSectionSkeleton />

        {/* Dishes skeleton */}
        <div className="space-y-5" aria-busy="true" aria-label="Loading dishes">
          <Skeleton className="h-7 w-44 rounded" />
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <DishCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Gallery skeleton */}
        <div className="space-y-4" aria-busy="true" aria-label="Loading photos">
          <Skeleton className="h-6 w-16 rounded" />
          <PhotoGallerySkeleton />
        </div>

      </div>
    </article>
  )
}

// JustVerifiedSection — Step 16, §4.1 Section 5
//
// Home page server component. Shows recently verified RestaurantDish records.
// Dish-first: dish name is the headline, restaurant is supporting context.
//
// Layout: single column mobile, 2-col tablet, 3-col desktop (§15.5.5)
// Omitted entirely when no recently verified dishes in the active city.
// Silent degradation on error.

import Link from 'next/link'
import { DiscoveryService } from 'features/search/services/discovery.service'
import { DishDiscoveryCard } from './DishDiscoveryCard'

interface JustVerifiedSectionProps {
  city?: string | null
}

export async function JustVerifiedSection({ city }: JustVerifiedSectionProps) {
  const dishes = await DiscoveryService.getJustVerified({
    location: city ?? undefined,
    limit:    6,
  })

  // §4.1: section omitted entirely when no results in the active city
  if (dishes.length === 0) return null

  return (
    <section aria-label="Just verified">
      <div className="flex items-baseline justify-between mb-1 px-4 md:px-0">
        <h2 className="font-display text-xl md:text-2xl font-semibold text-neutral-800">
          Just verified
        </h2>
      </div>
      <p className="text-sm text-neutral-500 mb-4 px-4 md:px-0">
        New dishes confirmed by our team
      </p>

      {/* Single col mobile, 2-col tablet, 3-col desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 md:px-0">
        {dishes.map((dish) => (
          <DishDiscoveryCard key={dish.restaurantDishId} dish={dish} city={city} />
        ))}
      </div>

      <div className="mt-5 px-4 md:px-0">
        <Link
          href="/category"
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
        >
          Explore all dishes →
        </Link>
      </div>
    </section>
  )
}

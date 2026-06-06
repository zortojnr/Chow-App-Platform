// TrendingDishesSection — Step 16, §4.1 Section 4
//
// Home page server component. 7-day acceleration window.
// Deduplicates: removes dishes already shown in PopularDishesSection.
// Omitted entirely when fewer than 4 non-duplicate trending dishes (§4.1).
// Silent degradation on error.

import { DiscoveryService } from 'features/search/services/discovery.service'
import { DishDiscoveryTile } from './DishDiscoveryTile'

interface TrendingDishesSectionProps {
  city?:            string | null
  excludeDishIds?:  string[]    // Popular dish IDs to exclude
}

export async function TrendingDishesSection({
  city,
  excludeDishIds = [],
}: TrendingDishesSectionProps) {
  let dishes = await DiscoveryService.getTrendingDishes({
    location:       city ?? undefined,
    limit:          8,
    excludeDishIds,
  })

  // §4.1: section omitted when fewer than 4 non-duplicate trending dishes
  if (dishes.length < 4) return null

  return (
    <section aria-label="Trending this week">
      <div className="mb-4 px-4 md:px-0">
        <h2 className="font-display text-xl md:text-2xl font-semibold text-neutral-800">
          Trending this week
        </h2>
      </div>

      {/* Horizontal scroll on mobile, grid on tablet+ */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none px-4 md:px-0 pb-1 md:grid md:grid-cols-4 lg:grid-cols-8 md:overflow-visible">
        {dishes.map((dish) => (
          <DishDiscoveryTile key={dish.dishId} dish={dish} city={city} />
        ))}
      </div>
    </section>
  )
}

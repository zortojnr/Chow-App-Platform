// PopularDishesSection — Step 16, §4.1 Section 3
//
// Home page server component. Fetches from DiscoveryService (server-side, cached).
// Horizontal scroll on mobile, grid on tablet+.
// Silent degradation: if data fails, section is omitted (§15.5.3).
//
// Section heading: "Popular in [City]" or "Popular right now"
// Fraunces text-2xl desktop / text-xl mobile (DS §15.5.5)

import Link from 'next/link'
import { DiscoveryService } from 'features/search/services/discovery.service'
import { DishDiscoveryTile } from './DishDiscoveryTile'

interface PopularDishesSectionProps {
  city?: string | null
}

export async function PopularDishesSection({ city }: PopularDishesSectionProps) {
  let dishes = await DiscoveryService.getPopularDishes({
    location: city ?? undefined,
    window:   '30d',
    limit:    8,
  })

  // Silent degradation — section omitted if no data
  if (dishes.length === 0) return null

  const heading = city ? `Popular in ${city}` : 'Popular right now'

  return (
    <section aria-label={heading}>
      <div className="flex items-baseline justify-between mb-4 px-4 md:px-0">
        <h2 className="font-display text-xl md:text-2xl font-semibold text-neutral-800">
          {heading}
        </h2>
        <Link
          href={`/search${city ? `?city=${encodeURIComponent(city)}` : ''}`}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
        >
          See all
        </Link>
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

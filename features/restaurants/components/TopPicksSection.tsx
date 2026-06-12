// TopPicksSection — curated high-confidence restaurants
//
// Server component. Fetches the top N restaurants by confidenceScore
// from the existing restaurant index (verified only, ordered by score).
// Shows a simple horizontal scroll card row on mobile, grid on desktop.

import Link from 'next/link'
import { RestaurantListingService } from '../services/restaurant-listing.service'
import { TrustBadge } from './TrustBadge'
import { MapPin } from 'lucide-react'

const PRICE: Record<string, string> = { BUDGET: '₦', MID: '₦₦', UPSCALE: '₦₦₦' }

const GRADIENTS = [
  'from-amber-400 to-orange-500',
  'from-green-400 to-emerald-600',
  'from-rose-400 to-pink-600',
  'from-sky-400 to-blue-600',
  'from-violet-400 to-purple-600',
  'from-teal-400 to-cyan-600',
  'from-yellow-400 to-amber-500',
  'from-indigo-400 to-blue-500',
]
function gradientFor(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

interface TopPicksSectionProps {
  city?: string
  limit?: number
}

export async function TopPicksSection({ city, limit = 6 }: TopPicksSectionProps) {
  const { restaurants } = await RestaurantListingService.getRestaurantIndex({
    city,
    limit,
    page: 1,
  })

  if (restaurants.length === 0) return null

  return (
    <section aria-labelledby="top-picks-heading">
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <h2
          id="top-picks-heading"
          className="font-display text-xl md:text-2xl font-semibold text-neutral-900"
        >
          Top Picks{city ? ` in ${city}` : ''}
        </h2>
        <Link
          href={city ? `/restaurants?city=${encodeURIComponent(city)}` : '/restaurants'}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
        >
          See all
        </Link>
      </div>

      {/* Horizontal scroll on mobile, 3-col grid on md+ */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-4 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
        {restaurants.map((r) => (
          <Link
            key={r.id}
            href={`/restaurants/${r.slug}`}
            className="shrink-0 w-56 md:w-auto block rounded-xl overflow-hidden bg-neutral-0 shadow-sm hover:shadow transition-all duration-normal hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-brand group"
          >
            {/* Thumbnail */}
            <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
              {r.thumbnailUrl ? (
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className={`flex items-center justify-center h-full bg-gradient-to-br ${gradientFor(r.name)}`} aria-hidden="true">
                  <span className="text-4xl font-display font-bold text-white/90">
                    {r.name[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute bottom-2 left-2">
                <TrustBadge scoreBand={r.confidenceScoreBand} size="sm" />
              </div>
            </div>

            {/* Info */}
            <div className="p-3">
              <p className="font-display font-semibold text-neutral-900 text-base leading-snug line-clamp-1">
                {r.name}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="flex items-center gap-1 text-xs text-neutral-500 truncate">
                  <MapPin size={11} className="shrink-0 text-neutral-400" aria-hidden="true" />
                  {r.area ?? r.city}
                </span>
                <span className="shrink-0 text-xs font-semibold text-amber-600 ml-2">
                  {PRICE[r.priceRange] ?? '₦₦'}
                </span>
              </div>
              {r.cuisineTypes.length > 0 && (
                <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                  {r.cuisineTypes.slice(0, 2).join(' · ')}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

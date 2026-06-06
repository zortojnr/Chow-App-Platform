// /restaurants — Step 7: Restaurant Browse Index
//
// Server Component. SSR with 5-minute ISR (§12.6 revalidate: 300).
// No auth required. City and priceRange filters via URL search params.
//
// Layout (§13.3):
//   - Page heading: Fraunces text-4xl — "Nigerian Restaurants" / "... in Abuja"
//   - City filter tabs (URL-based, no client JS)
//   - RestaurantCard grid: 2 col mobile, 3 tablet, 4 desktop
//   - Pagination: previous / next links
//   - Empty state when no restaurants match the filter
//
// Governed by: restaurant-listing-track.md §13.3, §12.4, §17

import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'
import { RestaurantCard } from 'features/restaurants/components'
import { cn } from '@/lib/utils'

export const revalidate = 300

// v1: Abuja only. Expand FILTER_CITIES when multi-city launches.
const FILTER_CITIES = ['Abuja']

interface Props {
  searchParams: Promise<{ city?: string; page?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { city } = await searchParams
  const title = city
    ? `Nigerian Restaurants in ${city} | Chow Here`
    : 'Verified Nigerian Restaurants | Chow Here'

  return {
    title,
    description: city
      ? `Browse verified Nigerian restaurants in ${city}.`
      : 'Browse all verified Nigerian restaurants on Chow Here.',
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_APP_URL}/restaurants${city ? `?city=${encodeURIComponent(city)}` : ''}`,
    },
  }
}

export default async function RestaurantBrowsePage({ searchParams }: Props) {
  const { city, page: pageParam } = await searchParams
  const page   = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const limit  = 12

  const data = await RestaurantListingService.getRestaurantIndex({ city, page, limit })

  const pageTitle = city ? `Nigerian Restaurants in ${city}` : 'Nigerian Restaurants'

  const buildHref = (p: number, c?: string) => {
    const params = new URLSearchParams()
    if (c)     params.set('city', c)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/restaurants${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">

      {/* ── Page heading ──────────────────────────────────── */}
      <h1 className="font-display text-4xl font-bold text-neutral-900 mb-6">
        {pageTitle}
      </h1>

      {/* ── City filter tabs ──────────────────────────────── */}
      <nav aria-label="Filter by city" className="mb-8">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Link
            href="/restaurants"
            aria-current={!city ? 'page' : undefined}
            className={cn(
              'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:shadow-brand',
              !city
                ? 'bg-neutral-900 text-neutral-0'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            All cities
          </Link>
          {FILTER_CITIES.map((c) => (
            <Link
              key={c}
              href={buildHref(1, c)}
              aria-current={city === c ? 'page' : undefined}
              className={cn(
                'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:shadow-brand',
                city === c
                  ? 'bg-neutral-900 text-neutral-0'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
              )}
            >
              {c}
            </Link>
          ))}
        </div>
      </nav>

      {/* ── Restaurant grid ───────────────────────────────── */}
      {data.restaurants.length > 0 ? (
        <>
          <div
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5"
            aria-label={`${data.total} restaurant${data.total === 1 ? '' : 's'} found`}
          >
            {data.restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>

          {/* ── Pagination ──────────────────────────────── */}
          {data.totalPages > 1 && (
            <nav
              aria-label="Page navigation"
              className="flex items-center justify-center gap-4 mt-10"
            >
              {page > 1 ? (
                <Link
                  href={buildHref(page - 1, city)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-300" aria-disabled="true">
                  <ChevronLeft size={16} aria-hidden="true" />
                  Previous
                </span>
              )}

              <span className="text-sm text-neutral-600" aria-live="polite">
                Page {page} of {data.totalPages}
              </span>

              {page < data.totalPages ? (
                <Link
                  href={buildHref(page + 1, city)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-300" aria-disabled="true">
                  Next
                  <ChevronRight size={16} aria-hidden="true" />
                </span>
              )}
            </nav>
          )}
        </>
      ) : (
        /* Empty state — §13.3 */
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          role="status"
          aria-label={city ? `No restaurants found in ${city}` : 'No restaurants found'}
        >
          <p className="font-display text-2xl font-semibold text-neutral-700 mb-2">
            {city
              ? `No verified restaurants in ${city} yet.`
              : 'No verified restaurants yet.'}
          </p>
          <p className="text-base text-neutral-500 mb-6">
            New listings are added as restaurants complete the verification process.
          </p>
          {city && (
            <Link
              href="/restaurants"
              className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-fast underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-brand"
            >
              View all in Abuja
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

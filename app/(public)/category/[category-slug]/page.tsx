// /category/[category-slug] — Step 18, §4.2, §15.1
//
// Category browse page. ISR revalidate: 3600s.
// Pre-rendered for all 9 DishCategory values.
//
// Structure:
//   - Category heading + description
//   - City filter tabs
//   - RestaurantCard grid (generic browse context — no save button)
//   - Empty state
//
// Uses RestaurantCard from Track 3 (neutral context, no dish match).
// Governed by: track-04-search-discovery.md §4.2, §16 Step 18

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'
import { RestaurantCard } from 'features/restaurants/components/RestaurantCard'
import { CATEGORY_META } from 'features/search/types/search.types'
import { CategoryChips } from 'features/search/components/CategoryChips'
import { cn } from '@/lib/utils'

export const revalidate = 3600

// ─── Static params for all 9 categories ──────────────────────

export async function generateStaticParams() {
  return Object.keys(CATEGORY_META).map((slug) => ({ 'category-slug': slug }))
}

// ─── Metadata ────────────────────────────────────────────────

interface Props {
  params:       Promise<{ 'category-slug': string }>
  searchParams: Promise<{ city?: string; page?: string }>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { 'category-slug': slug } = await params
  const { city }                  = await searchParams

  const meta = CATEGORY_META[slug]
  if (!meta) return {}

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://chowhere.com'
  const title = city
    ? `${meta.label} Restaurants in ${city} — Verified Nigerian Food | Chow Here`
    : `${meta.label} Restaurants — Verified Nigerian Food | Chow Here`

  return {
    title,
    description: meta.description,
    alternates:  { canonical: `${appUrl}/category/${slug}${city ? `?city=${encodeURIComponent(city)}` : ''}` },
    robots:      { index: true, follow: true },
  }
}

// ─── Page ────────────────────────────────────────────────────

const FILTER_CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano']

export default async function CategoryBrowsePage({ params, searchParams }: Props) {
  const { 'category-slug': slug }     = await params
  const { city, page: pageParam }     = await searchParams

  const meta = CATEGORY_META[slug]
  if (!meta) notFound()

  const page  = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const limit = 12

  const data = await RestaurantListingService.getRestaurantIndex({
    city,
    page,
    limit,
    cuisineType: meta.category,
  })

  const buildHref = (c?: string, p = 1) => {
    const sp = new URLSearchParams()
    if (c)     sp.set('city', c)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/category/${slug}${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 lg:py-12">

        {/* ── Page heading ──────────────────────────────── */}
        <div className="mb-2">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900">
            {meta.label}
          </h1>
        </div>
        <p className="text-base text-neutral-600 mb-6">{meta.description}</p>

        {/* ── City filter tabs ──────────────────────────── */}
        <nav aria-label="Filter by city" className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <Link
              href={buildHref()}
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
                href={buildHref(c)}
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

        {/* ── Restaurant grid ───────────────────────────── */}
        {data.restaurants.length > 0 ? (
          <>
            <div
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5"
              aria-label={`${data.total} restaurant${data.total === 1 ? '' : 's'} in ${meta.label}`}
            >
              {data.restaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <nav aria-label="Page navigation" className="flex items-center justify-center gap-4 mt-10">
                {page > 1 ? (
                  <Link
                    href={buildHref(city, page - 1)}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-neutral-300">← Previous</span>
                )}
                <span className="text-sm text-neutral-500">Page {page} of {data.totalPages}</span>
                {page < data.totalPages ? (
                  <Link
                    href={buildHref(city, page + 1)}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-neutral-300">Next →</span>
                )}
              </nav>
            )}
          </>
        ) : (
          // Empty state §15.5.2
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h2 className="font-display text-2xl font-semibold text-neutral-800 mb-2">
              No {meta.label} restaurants verified{city ? ` in ${city}` : ''} yet
            </h2>
            <p className="text-base text-neutral-600 max-w-sm mb-6">
              {city
                ? `This category hasn't been covered in ${city} yet.`
                : `No verified ${meta.label.toLowerCase()} restaurants yet.`}
            </p>
            <Link
              href="/submit"
              className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-amber-500 text-neutral-0 text-base font-semibold transition-colors duration-fast hover:bg-amber-600 focus-visible:outline-none focus-visible:shadow-brand"
            >
              Submit a restaurant
            </Link>
          </div>
        )}

        {/* ── Browse other categories ───────────────────── */}
        <div className="mt-12 pt-8 border-t border-neutral-200">
          <p className="text-sm font-medium text-neutral-500 mb-4">Browse other categories</p>
          <CategoryChips activeSlug={slug} />
        </div>

      </div>
    </div>
  )
}

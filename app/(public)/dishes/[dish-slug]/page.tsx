// /dishes/[dish-slug] — Step 17, §9.2, §9.3, §9.4
//
// Dish landing page — primary SEO asset.
// ISR revalidate: 1800s. Pre-rendered for all active dishes.
// Requires DishTaxonomy.slug (Step 0 — already migrated).
//
// Structure:
//   - Page heading: dish canonical name (Fraunces, text-4xl)
//   - Category badge
//   - City filter tabs (if multiple cities have results)
//   - Restaurant grid: SearchRestaurantCard
//   - Empty state per city
//
// SEO: unique title + description + ItemList JSON-LD structured data.
// Governed by: track-04-search-discovery.md §9.2–9.4, §16 Step 17

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { DishRestaurantService } from 'features/search/services/dish-restaurant.service'
import { SearchRestaurantCard, SearchRestaurantCardSkeleton } from 'features/search/components/SearchRestaurantCard'
import { ZeroResults } from 'features/search/components/ZeroResults'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const revalidate = 1800

// ─── Static params for all active dishes ─────────────────────

export async function generateStaticParams() {
  const dishes = await db.dishTaxonomy.findMany({
    where:  { isActive: true },
    select: { slug: true },
  })
  return dishes.map((d) => ({ 'dish-slug': d.slug }))
}

// ─── Metadata ────────────────────────────────────────────────

const CATEGORY_DISPLAY: Record<string, string> = {
  RICE_DISHES: 'Rice', SOUPS: 'Soups', SWALLOW: 'Swallow',
  STREET_FOOD: 'Street Food', PROTEIN: 'Protein', BREAKFAST: 'Breakfast',
  DRINKS: 'Drinks', SNACKS: 'Snacks', DESSERTS: 'Desserts',
}

interface Props {
  params:       Promise<{ 'dish-slug': string }>
  searchParams: Promise<{ city?: string; page?: string }>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { 'dish-slug': slug } = await params
  const { city }              = await searchParams

  const dish = await db.dishTaxonomy.findUnique({
    where: { slug },
    select: { canonicalName: true },
  })
  if (!dish) return {}

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://chowhere.com'
  const title = city
    ? `Where to Eat ${dish.canonicalName} in ${city} — Verified Restaurants | Chow Here`
    : `${dish.canonicalName} — Verified Nigerian Restaurants | Chow Here`

  const description = city
    ? `Find verified Nigerian restaurants serving ${dish.canonicalName} in ${city}. Confirmed dishes and real photos.`
    : `Find verified Nigerian restaurants serving ${dish.canonicalName} in Abuja.`

  return {
    title,
    description,
    alternates: { canonical: `${appUrl}/dishes/${slug}${city ? `?city=${encodeURIComponent(city)}` : ''}` },
    robots:     { index: true, follow: true },
  }
}

// ─── Page ────────────────────────────────────────────────────

// v1: Abuja only. Expand when multi-city launches.
const FILTER_CITIES = ['Abuja']

export default async function DishLandingPage({ params, searchParams }: Props) {
  const { 'dish-slug': slug } = await params
  const { city, page: pageParam } = await searchParams
  const page  = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  const dish = await db.dishTaxonomy.findUnique({
    where: { slug, isActive: true },
    select: { id: true, canonicalName: true, slug: true, category: true, aliases: true },
  })
  if (!dish) notFound()

  const { results, total } = await DishRestaurantService.getDishRestaurants(
    dish.id,
    '',                        // no FTS query on dish landing — ranking by confidence
    { city, page, limit: 20 },
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://chowhere.com'
  const buildHref = (c?: string, p = 1) => {
    const sp = new URLSearchParams()
    if (c)     sp.set('city', c)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/dishes/${slug}${qs ? `?${qs}` : ''}`
  }

  // ItemList JSON-LD structured data (§9.4)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    name:       city ? `Restaurants serving ${dish.canonicalName} in ${city}` : `Restaurants serving ${dish.canonicalName}`,
    numberOfItems: total,
    itemListElement: results.slice(0, 10).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Restaurant',
        name:    r.name,
        url:     `${appUrl}/restaurants/${r.slug}`,
        address: {
          '@type':           'PostalAddress',
          addressLocality:   r.city,
          addressRegion:     'Nigeria',
          addressCountry:    'NG',
        },
        servesCuisine: ['Nigerian'],
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 lg:py-12">

          {/* ── Page heading ──────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900">
                {dish.canonicalName}
              </h1>
              <Badge variant="category">
                {CATEGORY_DISPLAY[dish.category] ?? dish.category}
              </Badge>
            </div>
            {total > 0 && (
              <p className="text-base text-neutral-600">
                {total} verified restaurant{total === 1 ? '' : 's'}
                {city ? ` in ${city}` : ''}
              </p>
            )}
          </div>

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
          {results.length > 0 ? (
            <>
              <div
                className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5"
                aria-label={`${total} restaurant${total === 1 ? '' : 's'} serving ${dish.canonicalName}`}
              >
                {results.map((restaurant) => (
                  <SearchRestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </div>

              {/* Pagination */}
              {total > 20 && (
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
                  <span className="text-sm text-neutral-500">Page {page}</span>
                  {total > page * 20 ? (
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
            // Empty state per city §15.5.2
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h2 className="font-display text-2xl font-semibold text-neutral-800 mb-2">
                {city
                  ? `No restaurants serve ${dish.canonicalName} in ${city} yet`
                  : `No verified restaurants yet`}
              </h2>
              <p className="text-base text-neutral-600 max-w-sm mb-6">
                {city
                  ? `We haven't verified this dish in ${city} yet. More restaurants are being added.`
                  : `No verified restaurants serve this dish in Abuja yet.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/submit"
                  className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-amber-500 text-neutral-0 text-base font-semibold transition-colors duration-fast hover:bg-amber-600 focus-visible:outline-none focus-visible:shadow-brand"
                >
                  Submit a restaurant
                </Link>
                {city && (
                  <Link
                    href={buildHref()}
                    className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-neutral-0 text-neutral-700 text-base font-semibold border border-neutral-300 hover:bg-neutral-50 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                  >
                    View all in Abuja
                  </Link>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

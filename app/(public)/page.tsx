// Home page — Step 16, §4.1
//
// Discovery entry point. ISR revalidate: 3600s.
// Server component: fetches popular/trending/just-verified from DiscoveryService.
// City context read from chow-city cookie for server-rendered discovery sections.
//
// Structure:
//   1. Search Hero (wordmark + search bar + tagline)
//   2. Category Chips
//   3. Popular in [City]
//   4. Trending This Week (conditional — omitted if < 4 non-duplicate results)
//   5. Just Verified (conditional — omitted if no results)
//   6. Platform CTA
//
// WebSite JSON-LD with SearchAction (§9.5).
// Governed by: track-04-search-discovery.md §4.1, §9.5, §16 Step 16

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { HeroVideoSection } from './HeroVideoSection'
import { CategoryChips } from 'features/search/components/CategoryChips'
import { PopularDishesSection } from 'features/search/components/PopularDishesSection'
import { TrendingDishesSection } from 'features/search/components/TrendingDishesSection'
import { JustVerifiedSection } from 'features/search/components/JustVerifiedSection'
import { DiscoveryService } from 'features/search/services/discovery.service'
import Link from 'next/link'

export const revalidate = 3600

export const metadata: Metadata = {
  title:       'Chow Here — Find Verified Nigerian Restaurants, Dish by Dish',
  description: 'Discover the best Nigerian restaurants near you. Search by dish — Jollof Rice, Egusi, Suya, and more. Every listing is verified by our team.',
  alternates:  { canonical: process.env.NEXT_PUBLIC_APP_URL },
}

export default async function HomePage() {
  // Read city preference from cookie for server-side discovery sections
  const cookieStore = await cookies()
  const rawCity = cookieStore.get('chow-city')?.value
  // v1: default to Abuja so discovery sections always show "Popular in Abuja"
  const city = rawCity ? decodeURIComponent(rawCity) : 'Abuja'

  // Pre-fetch popular dishes to pass IDs to TrendingSection for deduplication
  const popularDishes = await DiscoveryService.getPopularDishes({
    location: city ?? undefined,
    window:   '30d',
    limit:    8,
  })
  const popularDishIds = popularDishes.map((d) => d.dishId)

  // WebSite JSON-LD with SearchAction
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://chowhere.com'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    url:        appUrl,
    name:       'Chow Here',
    potentialAction: {
      '@type':  'SearchAction',
      target:   { '@type': 'EntryPoint', urlTemplate: `${appUrl}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-neutral-50">

        {/* ── Section 1: Search Hero ─────────────────────────── */}
      <HeroVideoSection city={city} />

        {/* ── Main discovery content ────────────────────────── */}
        <div className="max-w-7xl mx-auto py-8 md:py-10 space-y-10 md:space-y-12">

          {/* ── Section 2: Category Chips ──────────────────── */}
          <div className="md:px-6 lg:px-8">
            <CategoryChips />
          </div>

          {/* ── Section 3: Popular Dishes ──────────────────── */}
          <div className="md:px-6 lg:px-8">
            <PopularDishesSection city={city} />
          </div>

          {/* ── Section 4: Trending This Week ──────────────── */}
          <div className="md:px-6 lg:px-8">
            <TrendingDishesSection city={city} excludeDishIds={popularDishIds} />
          </div>

          {/* ── Section 5: Just Verified ───────────────────── */}
          <div className="md:px-6 lg:px-8">
            <JustVerifiedSection city={city} />
          </div>

          {/* ── Section 6: Platform CTA ────────────────────── */}
          <div className="text-center pb-4 px-4 md:px-0">
            <Link
              href="/submit"
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
            >
              Know a great Nigerian restaurant? <span className="underline underline-offset-2">Submit it here</span>
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}

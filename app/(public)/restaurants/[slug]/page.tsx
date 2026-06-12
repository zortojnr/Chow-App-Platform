// /restaurants/[slug] — Step 7: Restaurant Profile Page
//
// Server Component. SSR with 5-minute ISR (§12.6 revalidate: 300).
// React.cache() deduplicates the service call between generateMetadata()
// and the page render within the same request.
//
// Sections in order (§13.2):
//   1. Hero         — mobile: full-width above content; lg+: left sidebar column
//   2. Identity     — <h1>, TrustBadge showBand, cuisine tags, price range
//   3. Location     — RestaurantContactSection show="location" (MapPin + area/address/city)
//   4. Dishes       — "What they serve" chip scroll + DishCard grid
//   5. Contact      — RestaurantContactSection show="contact" (phone + website + email)
//   6. Gallery      — PhotoGallery; primary photo excluded (§8.2 — hero only)
//   7. About        — conditional: omitted if null or < 10 chars (§16.5)
//
// Layout (§17.2):
//   < lg  — stacked single-column; hero full viewport width above content
//   lg+   — two-column sidebar: hero (photo+name) left, all detail sections right
//
// SEO: generateMetadata() + JSON-LD Restaurant schema (§12.7)
// 404: notFound() for non-APPROVED or missing slugs (§5.1)
//
// Governed by: restaurant-listing-track.md §7–§13, §17–§18

import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'
import {
  RestaurantHero,
  TrustBadge,
  DishCard,
  PhotoGallery,
  RestaurantContactSection,
  MapUnavailable,
} from 'features/restaurants/components'
import { Badge } from '@/components/ui/badge'
import { RestaurantMapSection } from './RestaurantMapSection'

export const revalidate = 300

// Deduplicates between generateMetadata() and page() in the same request
const getRestaurant = cache((slug: string) =>
  RestaurantListingService.getRestaurantProfile(slug),
)

// ─── Price display ─────────────────────────────────────────────
const PRICE_DISPLAY: Record<string, string> = {
  BUDGET:  '₦',
  MID:     '₦₦',
  UPSCALE: '₦₦₦',
}
const PRICE_VARIANT = {
  BUDGET:  'price-budget',
  MID:     'price-mid',
  UPSCALE: 'price-upscale',
} as const satisfies Record<string, 'price-budget' | 'price-mid' | 'price-upscale'>

// ─── Metadata ─────────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const restaurant = await getRestaurant(slug)

  if (!restaurant) return { title: 'Restaurant Not Found | Chow Here' }

  const primaryPhoto = restaurant.photos.find((p) => p.isPrimary)
  const description =
    restaurant.description?.slice(0, 160) ??
    `${restaurant.name} is a verified Nigerian restaurant in ${restaurant.city}.`

  return {
    title: `${restaurant.name} — Verified Nigerian Restaurant in ${restaurant.city} | Chow Here`,
    description,
    openGraph: {
      title: restaurant.name,
      description,
      siteName: 'Chow Here',
      ...(primaryPhoto && {
        images: [{ url: primaryPhoto.url, width: 1200, height: 630, alt: restaurant.name }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: restaurant.name,
      description,
      ...(primaryPhoto && { images: [primaryPhoto.url] }),
    },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_APP_URL}/restaurants/${restaurant.slug}`,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default async function RestaurantProfilePage({ params }: Props) {
  const { slug } = await params
  const restaurant = await getRestaurant(slug)

  if (!restaurant) notFound()

  const hasDescription =
    restaurant.description !== null && restaurant.description.length >= 10

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address,
      addressLocality: restaurant.city,
      addressRegion: restaurant.state,
      addressCountry: 'NG',
    },
    telephone: restaurant.phone,
    ...(restaurant.website ? { url: restaurant.website } : {}),
    servesCuisine:
      restaurant.cuisineTypes.length > 0 ? restaurant.cuisineTypes : ['Nigerian'],
    ...(restaurant.photos[0] ? { image: restaurant.photos[0].url } : {}),
  }

  // §8.2: primary photo is hero-only; gallery receives non-primary verified photos
  const galleryPhotos = restaurant.photos.filter((p) => !p.isPrimary)

  const contactProps = {
    phone:   restaurant.phone,
    address: restaurant.address,
    area:    restaurant.area,
    city:    restaurant.city,
    state:   restaurant.state,
    website: restaurant.website,
    email:   restaurant.email,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>

        {/* ── Mobile hero — full viewport width, hidden at lg+ ── */}
        <div className="lg:hidden">
          <RestaurantHero
            photos={restaurant.photos}
            name={restaurant.name}
            confidenceScoreBand={restaurant.confidenceScoreBand}
          />
        </div>

        {/* ── Content area ──────────────────────────────────── */}
        {/*
          §17.2 sidebar layout:
          < lg  — single column, detail sections stacked below mobile hero
          lg+   — two-column grid: hero (photo+name) left · details right
        */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="lg:grid lg:grid-cols-[2fr_3fr] lg:gap-10 lg:items-start">

            {/* ── Desktop left column: hero ─────────────── */}
            <aside className="hidden lg:block lg:sticky lg:top-8" aria-label="Restaurant photo">
              <RestaurantHero
                photos={restaurant.photos}
                name={restaurant.name}
                confidenceScoreBand={restaurant.confidenceScoreBand}
              />
            </aside>

            {/* ── Detail sections (right on desktop, full-width on mobile) */}
            <div className="space-y-10 mt-8 lg:mt-0">

              {/* ── 2. Identity ─────────────────────────── */}
              <section aria-label="Restaurant identity">
                {/* Semantic h1 — hero overlay is decorative (aria-hidden) §13.2 */}
                <h1 className="font-display font-bold text-neutral-900 leading-tight mb-3 text-2xl md:text-3xl lg:text-4xl">
                  {restaurant.name}
                </h1>

                <TrustBadge
                  scoreBand={restaurant.confidenceScoreBand}
                  showBand
                  className="mb-4"
                />

                <div className="flex flex-wrap items-center gap-2">
                  {restaurant.cuisineTypes.map((cuisine) => (
                    <Badge key={cuisine} variant="category">{cuisine}</Badge>
                  ))}
                  <Badge
                    variant={PRICE_VARIANT[restaurant.priceRange]}
                    aria-label={`Price range: ${restaurant.priceRange.toLowerCase()}`}
                  >
                    {PRICE_DISPLAY[restaurant.priceRange]}
                  </Badge>
                </div>
              </section>

              {/* ── 3. Location ─────────────────────────── */}
              <RestaurantContactSection {...contactProps} show="location" />

              {/* ── 3b. Map + Live Tracking (Track 7) ──── */}
              <section aria-label="Map and directions">
                {restaurant.latitude !== null && restaurant.longitude !== null ? (
                  <RestaurantMapSection
                    restaurantName={restaurant.name}
                    latitude={restaurant.latitude}
                    longitude={restaurant.longitude}
                  />
                ) : (
                  <MapUnavailable />
                )}
              </section>

              {/* ── 4. Dishes ───────────────────────────── */}
              <section aria-label="What they serve">
                <h2 className="font-display text-2xl font-semibold text-neutral-800 mb-5">
                  What they serve
                </h2>

                {restaurant.dishes.length > 0 ? (
                  <>
                    {/* Horizontal chip scroll — §17.7 amber-50/amber-700 pill style */}
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
                      {restaurant.dishes.map((dish) => (
                        <span
                          key={dish.id}
                          className="shrink-0 inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium bg-amber-50 text-amber-700"
                        >
                          {dish.canonicalName}
                        </span>
                      ))}
                    </div>

                    {/* DishCard grid — 1 col mobile, 2 tablet, 3 desktop §17.7 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {restaurant.dishes.map((dish) => (
                        <DishCard key={dish.id} dish={dish} />
                      ))}
                    </div>
                  </>
                ) : (
                  /* Empty state — §15.2 */
                  <div
                    className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-neutral-100"
                    role="status"
                    aria-label="No dishes listed"
                  >
                    <p className="font-display text-xl font-semibold text-neutral-700 mb-1">
                      No dishes listed yet
                    </p>
                    <p className="text-base text-neutral-500">
                      This restaurant hasn't had its dishes catalogued yet.
                    </p>
                  </div>
                )}
              </section>

              {/* ── 5. Contact ──────────────────────────── */}
              <RestaurantContactSection {...contactProps} show="contact" />

              {/* ── 6. Photo Gallery ────────────────────── */}
              {/* §8.2: galleryPhotos excludes primary (hero-only) */}
              <section aria-label="Photos">
                <h2 className="text-xl font-semibold text-neutral-800 mb-4">Photos</h2>
                <PhotoGallery
                  photos={galleryPhotos}
                  restaurantName={restaurant.name}
                />
              </section>

              {/* ── 7. About — omitted if null or < 10 chars §16.5 */}
              {hasDescription && (
                <section aria-label="About">
                  <h2 className="text-xl font-semibold text-neutral-800 mb-3">About</h2>
                  <p className="text-md text-neutral-700 max-w-prose leading-relaxed">
                    {restaurant.description}
                  </p>
                </section>
              )}

            </div>
          </div>
        </div>
      </article>
    </>
  )
}

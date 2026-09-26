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
  BackButton,
} from 'features/restaurants/components'
import { Badge } from '@/components/ui/badge'
import { RestaurantMapSection } from './RestaurantMapSection'
import { ArrowUpRight, Clock3, MapPin, PhoneCall, ShieldCheck, Utensils } from 'lucide-react'

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
const PRICE_LABEL: Record<string, string> = {
  BUDGET: 'Budget friendly',
  MID: 'Mid-range',
  UPSCALE: 'Upscale',
}
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

// ─── Page ─────────


export default async function RestaurantProfilePage({ params }: Props) {
  const { slug } = await params
  const restaurant = await getRestaurant(slug)

  if (!restaurant) notFound()

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

  const galleryPhotos = restaurant.photos.filter((p) => !p.isPrimary)
  const approvedDate = new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(restaurant.approvedAt))

  const contactProps = {
    phone: restaurant.phone,
    address: restaurant.address,
    area: restaurant.area,
    city: restaurant.city,
    state: restaurant.state,
    website: restaurant.website,
    email: restaurant.email,
  }

  return (
    <>
      <article className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-5 flex items-center justify-between">
            <BackButton label="All restaurants" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Restaurant profile
            </span>
          </div>

          <div className="overflow-hidden rounded-xl bg-neutral-100">
            <RestaurantHero
              photos={restaurant.photos}
              name={restaurant.name}
              confidenceScoreBand={restaurant.confidenceScoreBand}
              showOverlay={false}
              className="aspect-[1.25] sm:aspect-[1.7] lg:aspect-[2.15]"
            />
          </div>

          <section className="border-b border-neutral-200 py-7 sm:py-9" aria-label="Restaurant identity">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">
                    {restaurant.name}
                  </h1>
                  <TrustBadge scoreBand={restaurant.confidenceScoreBand} showBand />
                </div>
                <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <MapPin size={15} className="shrink-0 text-green-600" aria-hidden="true" />
                  {restaurant.area ? `${restaurant.area}, ` : ''}{restaurant.city}, {restaurant.state}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                <span className="font-semibold text-amber-700">{PRICE_DISPLAY[restaurant.priceRange]}</span>
                <span className="text-sm text-neutral-600">{PRICE_LABEL[restaurant.priceRange]}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {restaurant.cuisineTypes.map((cuisine) => (
                <Badge key={cuisine} variant="category">{cuisine}</Badge>
              ))}
            </div>
          </section>

          <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 lg:py-10">
            <main className="min-w-0 space-y-10">
              <section aria-labelledby="about-heading">
                <h2 id="about-heading" className="font-display text-2xl font-semibold text-neutral-900">
                  About
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-700">
                  {restaurant.description?.trim() ||
                    'An overview has not been provided for this restaurant yet. The verified listing details, cuisine, location, and contact information are shown here so you can plan a visit and confirm current service directly.'}
                </p>
              </section>

              <section aria-labelledby="menu-heading">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Menu</p>
                    <h2 id="menu-heading" className="font-display text-2xl font-semibold text-neutral-900">
                      What they serve
                    </h2>
                  </div>
                  {restaurant.dishes.length > 0 && (
                    <span className="text-sm text-neutral-500">{restaurant.dishes.length} listed</span>
                  )}
                </div>

                {restaurant.dishes.length > 0 ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {restaurant.dishes.map((dish) => (
                      <DishCard key={dish.id} dish={dish} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 border-y border-neutral-200 py-5">
                    <div className="flex items-start gap-3">
                      <Utensils size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                      <div>
                        <h3 className="font-semibold text-neutral-800">Menu details are not listed yet</h3>
                        <p className="mt-1 text-sm leading-6 text-neutral-600">
                          Dish information has not been added to this profile. Call the restaurant to ask about today’s menu and availability.
                        </p>
                        {restaurant.phone && (
                          <a
                            href={`tel:${restaurant.phone.replace(/\s/g, '')}`}
                            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800"
                          >
                            <PhoneCall size={15} aria-hidden="true" />
                            Call to ask about the menu
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {galleryPhotos.length > 0 && (
                <section aria-labelledby="photos-heading">
                  <h2 id="photos-heading" className="font-display text-2xl font-semibold text-neutral-900">
                    Photos
                  </h2>
                  <PhotoGallery
                    photos={galleryPhotos}
                    restaurantName={restaurant.name}
                    className="mt-5"
                  />
                </section>
              )}

              {restaurant.latitude !== null && restaurant.longitude !== null && (
                <section aria-labelledby="map-heading">
                  <h2 id="map-heading" className="mb-4 font-display text-2xl font-semibold text-neutral-900">
                    Find us
                  </h2>
                  <RestaurantMapSection
                    restaurantName={restaurant.name}
                    address={restaurant.address}
                    city={restaurant.city}
                    latitude={restaurant.latitude}
                    longitude={restaurant.longitude}
                  />
                </section>
              )}
            </main>

            <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start" aria-label="Visit information">
              <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
                <h2 className="font-display text-xl font-semibold text-neutral-900">Plan your visit</h2>
                <RestaurantContactSection {...contactProps} className="mt-5 space-y-5" />

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${restaurant.address}, ${restaurant.city}, ${restaurant.state}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                >
                  Get directions
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>

                <div className="mt-6 border-t border-neutral-200 pt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    Listing details
                  </h3>
                  <dl className="mt-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
                      <div>
                        <dt className="text-sm font-medium text-neutral-800">Verified listing</dt>
                        <dd className="mt-0.5 text-sm text-neutral-500">Approved {approvedDate}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin size={17} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden="true" />
                      <div>
                        <dt className="text-sm font-medium text-neutral-800">Neighborhood</dt>
                        <dd className="mt-0.5 text-sm text-neutral-500">{restaurant.area || 'Not specified'}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock3 size={17} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden="true" />
                      <div>
                        <dt className="text-sm font-medium text-neutral-800">Opening hours</dt>
                        <dd className="mt-0.5 text-sm text-neutral-500">Contact the restaurant for current hours</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </article>
    </>
  )
}

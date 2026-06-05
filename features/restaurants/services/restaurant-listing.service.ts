// Restaurant Listing Service
//
// Read-only queries for the public consumer surface. Serves three routes:
//   GET /api/v1/restaurants/:slug        → getRestaurantProfile()
//   GET /api/v1/restaurants/:slug/dishes → getRestaurantDishes()
//   GET /api/v1/restaurants              → getRestaurantIndex()
//
// Security contract (restaurant-listing-track.md §5.1, §12.2):
//   - Only APPROVED restaurants are returned. Non-APPROVED slugs return null.
//   - No distinction between "not found" and "not approved" — prevents
//     reconnaissance of the submission pipeline.
//   - Raw confidenceScore is NEVER returned. Mapped to ScoreBand label only.
//   - Admin-internal fields (verificationStatus, deletedAt, internalNotes,
//     VerificationRecord details, VerificationEvent history) are excluded.
//   - Only photos where isVerified = true appear in any consumer response.
//
// DB notes:
//   - Uses `db` (soft-delete extension, verificationStatus write guard).
//   - `findFirst` used instead of `findUnique` for Restaurant and RestaurantDish
//     because findUnique is not intercepted by the soft-delete extension.
//   - `count` is not intercepted by the extension; deletedAt: null is added
//     explicitly in all count calls.
//
// Governed by: restaurant-listing-track.md §12, §14, master-architecture.md §8

import { db } from '@/lib/db'
import type { DishAvailabilityStatus, DishCategory, PriceRange } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'

// ─── Score band mapping ───────────────────────────────────────
// Consumer-safe labels only. Raw scores are admin-only.
// restaurant-listing-track.md §7.2
type ScoreBand = 'EXCELLENT' | 'STRONG' | 'VERIFIED'

function toScoreBand(score: Decimal): ScoreBand {
  const n = score.toNumber()
  if (n >= 0.9) return 'EXCELLENT'
  if (n >= 0.7) return 'STRONG'
  return 'VERIFIED'
}

// ─── Response types ───────────────────────────────────────────

export type DishSummary = {
  id: string
  canonicalName: string
  nameAsServed: string | null
  availabilityStatus: DishAvailabilityStatus
  price: string | null          // Decimal serialised as string; null if unset
  isAdminVerified: boolean      // true when verifiedAt IS NOT NULL — consumer label: "Confirmed"
  category: DishCategory
}

export type RestaurantProfileResponse = {
  id: string
  name: string
  slug: string
  description: string | null
  phone: string
  address: string
  area: string | null
  city: string
  state: string
  priceRange: PriceRange
  cuisineTypes: string[]
  website: string | null
  email: string | null
  confidenceScoreBand: ScoreBand
  verificationBadge: 'VERIFIED'
  photos: {
    id: string
    url: string
    isPrimary: boolean
  }[]
  dishes: DishSummary[]
  submittedAt: string            // ISO-8601 — Restaurant.createdAt
  approvedAt: string             // ISO-8601 — most recent APPROVED VerificationEvent
}

export type RestaurantCardResponse = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  priceRange: PriceRange
  cuisineTypes: string[]
  confidenceScoreBand: ScoreBand
  thumbnailUrl: string | null
  thumbnailBlurHash: string | null   // Blurhash placeholder shown while image loads
  dishCount: number
}

export type RestaurantIndexResponse = {
  restaurants: RestaurantCardResponse[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type DishListResponse = {
  dishes: DishSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Service ──────────────────────────────────────────────────

export const RestaurantListingService = {
  /**
   * Fetches a full consumer profile for an approved restaurant by slug.
   * Returns null if the slug does not exist OR if the restaurant is not APPROVED.
   * The caller must treat null as a 404 — no disclosure of non-approved existence.
   */
  async getRestaurantProfile(slug: string): Promise<RestaurantProfileResponse | null> {
    const restaurant = await db.restaurant.findFirst({
      where: {
        slug,
        verificationStatus: 'APPROVED',
        // deletedAt: null is injected automatically by the soft-delete extension
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        phone: true,
        address: true,
        area: true,
        city: true,
        state: true,
        priceRange: true,
        cuisineTypes: true,
        website: true,
        email: true,
        confidenceScore: true,
        createdAt: true,
        photos: {
          where: { isVerified: true },
          select: { id: true, url: true, isPrimary: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        dishes: {
          where: { deletedAt: null },
          select: {
            id: true,
            nameAsServed: true,
            availabilityStatus: true,
            price: true,
            verifiedAt: true,
            dish: {
              select: {
                canonicalName: true,
                category: true,
              },
            },
          },
          // Verified dishes first, then by submission order
          orderBy: [{ verifiedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
        },
        verification: {
          select: {
            events: {
              where: { toStatus: 'APPROVED' },
              select: { createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!restaurant) return null

    const approvedAt = restaurant.verification?.events[0]?.createdAt ?? restaurant.createdAt

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      phone: restaurant.phone,
      address: restaurant.address,
      area: restaurant.area,
      city: restaurant.city,
      state: restaurant.state,
      priceRange: restaurant.priceRange,
      cuisineTypes: restaurant.cuisineTypes,
      website: restaurant.website,
      email: restaurant.email,
      confidenceScoreBand: toScoreBand(restaurant.confidenceScore),
      verificationBadge: 'VERIFIED',
      photos: restaurant.photos,
      dishes: restaurant.dishes.map((d) => ({
        id: d.id,
        canonicalName: d.dish.canonicalName,
        nameAsServed: d.nameAsServed,
        availabilityStatus: d.availabilityStatus,
        price: d.price?.toString() ?? null,
        isAdminVerified: d.verifiedAt !== null,
        category: d.dish.category,
      })),
      submittedAt: restaurant.createdAt.toISOString(),
      approvedAt: approvedAt.toISOString(),
    }
  },

  /**
   * Paginated dish list for a restaurant.
   * Returns null if the restaurant does not exist or is not APPROVED.
   * restaurant-listing-track.md §12.3
   */
  async getRestaurantDishes(
    restaurantId: string,
    params: { page?: number; limit?: number; category?: DishCategory },
  ): Promise<DishListResponse | null> {
    const exists = await db.restaurant.findFirst({
      where: { id: restaurantId, verificationStatus: 'APPROVED' },
      select: { id: true },
    })
    if (!exists) return null

    const page  = Math.max(1, params.page  ?? 1)
    const limit = Math.min(20, Math.max(1, params.limit ?? 20))
    const skip  = (page - 1) * limit

    const where = {
      restaurantId,
      deletedAt: null,
      ...(params.category ? { dish: { category: params.category } } : {}),
    }

    const [dishes, total] = await Promise.all([
      db.restaurantDish.findMany({
        where,
        select: {
          id: true,
          nameAsServed: true,
          availabilityStatus: true,
          price: true,
          verifiedAt: true,
          dish: { select: { canonicalName: true, category: true } },
        },
        orderBy: [{ verifiedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
        take: limit,
        skip,
      }),
      // count is not intercepted by the soft-delete extension; deletedAt: null is explicit
      db.restaurantDish.count({ where }),
    ])

    return {
      dishes: dishes.map((d) => ({
        id: d.id,
        canonicalName: d.dish.canonicalName,
        nameAsServed: d.nameAsServed,
        availabilityStatus: d.availabilityStatus,
        price: d.price?.toString() ?? null,
        isAdminVerified: d.verifiedAt !== null,
        category: d.dish.category,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  /**
   * Paginated browse index of approved restaurants.
   * Optional city filter (case-insensitive). Optional priceRange filter.
   * restaurant-listing-track.md §12.4
   */
  async getRestaurantIndex(params: {
    city?: string
    page?: number
    limit?: number
    priceRange?: PriceRange
  }): Promise<RestaurantIndexResponse> {
    const page  = Math.max(1, params.page  ?? 1)
    const limit = Math.min(20, Math.max(1, params.limit ?? 12))
    const skip  = (page - 1) * limit

    const where = {
      verificationStatus: 'APPROVED' as const,
      deletedAt: null,
      ...(params.city
        ? { city: { equals: params.city, mode: 'insensitive' as const } }
        : {}),
      ...(params.priceRange ? { priceRange: params.priceRange } : {}),
    }

    const [restaurants, total] = await Promise.all([
      db.restaurant.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          area: true,
          priceRange: true,
          cuisineTypes: true,
          confidenceScore: true,
          thumbnailUrl: true,
          thumbnailBlurHash: true,
          _count: { select: { dishes: { where: { deletedAt: null } } } },
        },
        orderBy: [{ confidenceScore: 'desc' }, { updatedAt: 'desc' }],
        take: limit,
        skip,
      }),
      // count is not intercepted by the soft-delete extension; deletedAt: null is explicit
      db.restaurant.count({ where }),
    ])

    return {
      restaurants: restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        city: r.city,
        area: r.area,
        priceRange: r.priceRange,
        cuisineTypes: r.cuisineTypes,
        confidenceScoreBand: toScoreBand(r.confidenceScore),
        thumbnailUrl: r.thumbnailUrl,
        thumbnailBlurHash: r.thumbnailBlurHash,
        dishCount: r._count.dishes,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },
}

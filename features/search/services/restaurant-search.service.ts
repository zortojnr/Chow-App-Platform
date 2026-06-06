// Restaurant Search Service — Step 3
//
// FTS search over Restaurant.searchVector (name, city, area, description).
// Enforces: APPROVED only, deletedAt IS NULL, city filter when provided.
//
// This service searches restaurant names directly — distinct from
// dish-restaurant.service.ts which finds restaurants serving a specific dish.
//
// Governed by: track-04-search-discovery.md §3.2, search-system-track.md §4

import { Prisma } from '@prisma/client'
import type { PriceRange } from '@prisma/client'
import { db } from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────

type ScoreBand = 'EXCELLENT' | 'STRONG' | 'VERIFIED'

export type RestaurantSearchResult = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  priceRange: PriceRange
  confidenceScoreBand: ScoreBand
  thumbnailUrl: string | null
  dishesServed: number
  matchScore: number
  distanceKm: null   // Phase 2 placeholder — always null
}

type RawRestaurantRow = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  priceRange: string
  confidenceScore: string
  thumbnailUrl: string | null
  dishesServed: bigint | number
  matchScore: number | string
}

// ─── Score band ───────────────────────────────────────────────

function toScoreBand(score: string): ScoreBand {
  const n = parseFloat(score)
  if (n >= 0.9) return 'EXCELLENT'
  if (n >= 0.7) return 'STRONG'
  return 'VERIFIED'
}

// ─── Public API ───────────────────────────────────────────────

export const RestaurantSearchService = {
  /**
   * FTS search over restaurant names.
   * City filter is mandatory when provided — results outside the city are never returned.
   */
  async search(
    query: string,
    options: { city?: string; page?: number; limit?: number } = {},
  ): Promise<RestaurantSearchResult[]> {
    const { city, page = 1, limit = 20 } = options
    const trimmed = query.trim().slice(0, 200)
    if (trimmed.length < 2) return []

    const offset = (page - 1) * limit
    const cityFilter = city
      ? Prisma.sql`AND r.city ILIKE ${city}`
      : Prisma.sql``

    try {
      const rows = await db.$queryRaw<RawRestaurantRow[]>(Prisma.sql`
        SELECT
          r.id,
          r.name,
          r.slug,
          r.city,
          r.area,
          r."priceRange"::text                            AS "priceRange",
          r."confidenceScore"::text                       AS "confidenceScore",
          r."thumbnailUrl",
          COALESCE(dc.cnt, 0)                             AS "dishesServed",
          ts_rank_cd(r."searchVector",
            websearch_to_tsquery('english', unaccent(${trimmed}))) AS "matchScore"
        FROM "Restaurant" r
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt
          FROM "RestaurantDish" rd
          WHERE rd."restaurantId" = r.id AND rd."deletedAt" IS NULL
        ) dc ON true
        WHERE r."verificationStatus"::text = 'APPROVED'
          AND r."deletedAt" IS NULL
          ${cityFilter}
          AND r."searchVector" @@ websearch_to_tsquery('english', unaccent(${trimmed}))
        ORDER BY "matchScore" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `)

      return rows.map(toResult)
    } catch {
      return []
    }
  },
}

// ─── Serialisation ────────────────────────────────────────────

function toResult(row: RawRestaurantRow): RestaurantSearchResult {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city,
    area: row.area,
    priceRange: row.priceRange as PriceRange,
    confidenceScoreBand: toScoreBand(row.confidenceScore),
    thumbnailUrl: row.thumbnailUrl,
    dishesServed: Number(row.dishesServed),
    matchScore: Number(row.matchScore),
    distanceKm: null,
  }
}

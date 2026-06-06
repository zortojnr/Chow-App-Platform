// Dish-Restaurant Resolver — Step 4
//
// Given a dishId, returns a ranked list of restaurants serving that dish.
// Implements the authoritative ranking formula from track-04 §5.1:
//
//   display_score = (
//     fts_relevance    * 0.40   ← restaurant name relevance to original query
//     confidence_score * 0.35   ← verification quality
//     availability     * 0.15   ← dish availability at this restaurant
//     recency          * 0.10   ← how recently the restaurant was verified/updated
//   )
//
// When no query is provided (e.g. dish landing page), FTS weight = 0
// and ranking is purely by confidence + availability + recency.
//
// Note on approvedAt: the Restaurant schema has no dedicated approvedAt field.
// r."updatedAt" is used as the recency signal — it reflects the most recent
// admin action (status change, intelligence update) which closely approximates
// the approval date.
//
// Always includes restaurantDishId in results — required for the save interaction.
// Always includes distanceKm: null — Phase 2 placeholder.
//
// Governed by: track-04-search-discovery.md §5.1, §7.2

import { Prisma } from '@prisma/client'
import type { DishAvailabilityStatus, PriceRange } from '@prisma/client'
import { db } from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────

type ScoreBand = 'EXCELLENT' | 'STRONG' | 'VERIFIED'

export type MatchedDishContext = {
  restaurantDishId: string          // RestaurantDish.id — required for save action
  nameAsServed: string | null
  availabilityStatus: DishAvailabilityStatus
  price: string | null              // Decimal serialised as string
}

export type DishRestaurantResult = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  priceRange: PriceRange
  confidenceScoreBand: ScoreBand
  thumbnailUrl: string | null
  dishesServed: number
  matchedDish: MatchedDishContext
  displayScore: number
  distanceKm: null                  // Phase 2 placeholder — always null
}

type RawRow = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  priceRange: string
  confidenceScore: string
  thumbnailUrl: string | null
  dishesServed: bigint | number
  restaurantDishId: string
  nameAsServed: string | null
  availabilityStatus: string
  price: string | null
  displayScore: number | string
}

// ─── Score band ───────────────────────────────────────────────

function toScoreBand(score: string): ScoreBand {
  const n = parseFloat(score)
  if (n >= 0.9) return 'EXCELLENT'
  if (n >= 0.7) return 'STRONG'
  return 'VERIFIED'
}

// ─── Public API ───────────────────────────────────────────────

export const DishRestaurantService = {
  /**
   * Returns ranked restaurants serving the given dish.
   *
   * @param dishId  — The DishTaxonomy.id to look up
   * @param query   — Original user search query for FTS relevance (optional)
   * @param options — city, area (Phase 1: parsed but area not applied), page, limit
   */
  async getDishRestaurants(
    dishId: string,
    query: string | undefined,
    options: { city?: string; area?: string; page?: number; limit?: number } = {},
  ): Promise<{ results: DishRestaurantResult[]; total: number }> {
    const { city, page = 1, limit = 20 } = options
    const offset = (page - 1) * limit
    const hasQuery = typeof query === 'string' && query.trim().length >= 2

    const cityFilter = city
      ? Prisma.sql`AND r.city ILIKE ${city}`
      : Prisma.sql``

    try {
      if (hasQuery) {
        return await queryWithFTS(dishId, query!.trim(), cityFilter, limit, offset)
      }
      return await queryWithoutFTS(dishId, cityFilter, limit, offset)
    } catch {
      return { results: [], total: 0 }
    }
  },
}

// ─── Query: with FTS ──────────────────────────────────────────

async function queryWithFTS(
  dishId: string,
  query: string,
  cityFilter: Prisma.Sql,
  limit: number,
  offset: number,
): Promise<{ results: DishRestaurantResult[]; total: number }> {
  const [rows, countRows] = await Promise.all([
    db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        r.id,
        r.name,
        r.slug,
        r.city,
        r.area,
        r."priceRange"::text                                        AS "priceRange",
        r."confidenceScore"::text                                   AS "confidenceScore",
        r."thumbnailUrl",
        COALESCE(dc.cnt, 0)                                         AS "dishesServed",
        rd.id                                                       AS "restaurantDishId",
        rd."nameAsServed",
        rd."availabilityStatus"::text                               AS "availabilityStatus",
        rd.price::text                                              AS price,
        (
          ts_rank_cd(r."searchVector",
            websearch_to_tsquery('english', unaccent(${query})))    * 0.40
          + CAST(r."confidenceScore" AS float8)                     * 0.35
          + CASE rd."availabilityStatus"::text
              WHEN 'ALWAYS_AVAILABLE' THEN 0.15
              WHEN 'WEEKEND_ONLY'     THEN 0.10
              WHEN 'SEASONAL'         THEN 0.08
              WHEN 'ON_ORDER'         THEN 0.05
              ELSE 0.00
            END
          + CASE
              WHEN r."updatedAt" > NOW() - INTERVAL '30 days' THEN 0.10
              WHEN r."updatedAt" > NOW() - INTERVAL '90 days' THEN 0.05
              ELSE 0.00
            END
        )                                                           AS "displayScore"
      FROM "RestaurantDish" rd
      JOIN "Restaurant" r ON r.id = rd."restaurantId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM "RestaurantDish" rd2
        WHERE rd2."restaurantId" = r.id AND rd2."deletedAt" IS NULL
      ) dc ON true
      WHERE rd."dishId" = ${dishId}
        AND rd."deletedAt" IS NULL
        AND r."verificationStatus"::text = 'APPROVED'
        AND r."deletedAt" IS NULL
        ${cityFilter}
      ORDER BY "displayScore" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM "RestaurantDish" rd
      JOIN "Restaurant" r ON r.id = rd."restaurantId"
      WHERE rd."dishId" = ${dishId}
        AND rd."deletedAt" IS NULL
        AND r."verificationStatus"::text = 'APPROVED'
        AND r."deletedAt" IS NULL
        ${cityFilter}
    `),
  ])

  return {
    results: rows.map(toResult),
    total: Number(countRows[0]?.total ?? 0),
  }
}

// ─── Query: without FTS (dish landing page) ───────────────────

async function queryWithoutFTS(
  dishId: string,
  cityFilter: Prisma.Sql,
  limit: number,
  offset: number,
): Promise<{ results: DishRestaurantResult[]; total: number }> {
  const [rows, countRows] = await Promise.all([
    db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        r.id,
        r.name,
        r.slug,
        r.city,
        r.area,
        r."priceRange"::text                    AS "priceRange",
        r."confidenceScore"::text               AS "confidenceScore",
        r."thumbnailUrl",
        COALESCE(dc.cnt, 0)                     AS "dishesServed",
        rd.id                                   AS "restaurantDishId",
        rd."nameAsServed",
        rd."availabilityStatus"::text           AS "availabilityStatus",
        rd.price::text                          AS price,
        (
          CAST(r."confidenceScore" AS float8)   * 0.35
          + CASE rd."availabilityStatus"::text
              WHEN 'ALWAYS_AVAILABLE' THEN 0.15
              WHEN 'WEEKEND_ONLY'     THEN 0.10
              WHEN 'SEASONAL'         THEN 0.08
              WHEN 'ON_ORDER'         THEN 0.05
              ELSE 0.00
            END
          + CASE
              WHEN r."updatedAt" > NOW() - INTERVAL '30 days' THEN 0.10
              WHEN r."updatedAt" > NOW() - INTERVAL '90 days' THEN 0.05
              ELSE 0.00
            END
        )                                       AS "displayScore"
      FROM "RestaurantDish" rd
      JOIN "Restaurant" r ON r.id = rd."restaurantId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM "RestaurantDish" rd2
        WHERE rd2."restaurantId" = r.id AND rd2."deletedAt" IS NULL
      ) dc ON true
      WHERE rd."dishId" = ${dishId}
        AND rd."deletedAt" IS NULL
        AND r."verificationStatus"::text = 'APPROVED'
        AND r."deletedAt" IS NULL
        ${cityFilter}
      ORDER BY "displayScore" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM "RestaurantDish" rd
      JOIN "Restaurant" r ON r.id = rd."restaurantId"
      WHERE rd."dishId" = ${dishId}
        AND rd."deletedAt" IS NULL
        AND r."verificationStatus"::text = 'APPROVED'
        AND r."deletedAt" IS NULL
        ${cityFilter}
    `),
  ])

  return {
    results: rows.map(toResult),
    total: Number(countRows[0]?.total ?? 0),
  }
}

// ─── Serialisation ────────────────────────────────────────────

function toResult(row: RawRow): DishRestaurantResult {
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
    matchedDish: {
      restaurantDishId: row.restaurantDishId,
      nameAsServed: row.nameAsServed,
      availabilityStatus: row.availabilityStatus as DishAvailabilityStatus,
      price: row.price,
    },
    displayScore: Number(row.displayScore),
    distanceKm: null,
  }
}

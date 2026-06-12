// Dish-Restaurant Resolver — Step 4
//
// Given a dishId, returns a ranked list of restaurants serving that dish.
// Implements the authoritative ranking formula from track-04 §5.1 and
// Track 7 GPS extension (track-07-navigation-location.md §5):
//
//   Without GPS (original):
//     display_score = fts_relevance * 0.40 + confidence * 0.35
//                   + availability * 0.15 + recency * 0.10
//
//   With GPS (Track 7):
//     display_score = fts_relevance * 0.35 + proximity * 0.25
//                   + confidence * 0.20 + (availability + recency) * 0.20
//
// When no query is provided (e.g. dish landing page), FTS weight = 0
// and ranking is purely by confidence + availability + recency.
//
// distanceKm is computed in TypeScript from Haversine (src/lib/geo.ts).
// User GPS coordinates are NEVER written to the database or logs.
//
// Governed by: track-04-search-discovery.md §5.1, §7.2
//              track-07-navigation-location.md §5

import { Prisma } from '@prisma/client'
import type { DishAvailabilityStatus, PriceRange } from '@prisma/client'
import { db } from '@/lib/db'
import { haversineKm } from '@/lib/geo'

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
  distanceKm: number | null         // null when GPS unavailable or restaurant not geocoded
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
  latitude: number | null
  longitude: number | null
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
   * @param options — city, area, page, limit, userLat, userLng
   *
   * Privacy: userLat and userLng are used only for ranking and distance
   * display. They are never persisted to the database or written to logs.
   */
  async getDishRestaurants(
    dishId: string,
    query: string | undefined,
    options: {
      city?: string
      area?: string
      page?: number
      limit?: number
      userLat?: number
      userLng?: number
    } = {},
  ): Promise<{ results: DishRestaurantResult[]; total: number }> {
    const { city, page = 1, limit = 20, userLat, userLng } = options
    const offset = (page - 1) * limit
    const hasQuery = typeof query === 'string' && query.trim().length >= 2
    const hasGPS   = userLat !== undefined && userLng !== undefined

    const cityFilter = city
      ? Prisma.sql`AND r.city ILIKE ${city}`
      : Prisma.sql``

    try {
      if (hasQuery && hasGPS) {
        return await queryWithFTS_GPS(dishId, query!.trim(), cityFilter, userLat!, userLng!, limit, offset)
      }
      if (hasQuery) {
        return await queryWithFTS(dishId, query!.trim(), cityFilter, limit, offset)
      }
      if (hasGPS) {
        return await queryWithoutFTS_GPS(dishId, cityFilter, userLat!, userLng!, limit, offset)
      }
      return await queryWithoutFTS(dishId, cityFilter, limit, offset)
    } catch {
      return { results: [], total: 0 }
    }
  },
}

// ─── Shared SELECT columns ────────────────────────────────────

const baseSelect = Prisma.sql`
  r.id,
  r.name,
  r.slug,
  r.city,
  r.area,
  r."priceRange"::text                                        AS "priceRange",
  r."confidenceScore"::text                                   AS "confidenceScore",
  r."thumbnailUrl",
  r.latitude,
  r.longitude,
  COALESCE(dc.cnt, 0)                                         AS "dishesServed",
  rd.id                                                       AS "restaurantDishId",
  rd."nameAsServed",
  rd."availabilityStatus"::text                               AS "availabilityStatus",
  rd.price::text                                              AS price
`

const joinAndWhere = (dishId: string, cityFilter: Prisma.Sql) => Prisma.sql`
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
`

const countQuery = (dishId: string, cityFilter: Prisma.Sql) => Prisma.sql`
  SELECT COUNT(*) AS total
  FROM "RestaurantDish" rd
  JOIN "Restaurant" r ON r.id = rd."restaurantId"
  WHERE rd."dishId" = ${dishId}
    AND rd."deletedAt" IS NULL
    AND r."verificationStatus"::text = 'APPROVED'
    AND r."deletedAt" IS NULL
    ${cityFilter}
`

// Haversine proximity score expression (0–1, clamped).
// Resolves to 0.0 when the restaurant has no coordinates.
const proximityExpr = (userLat: number, userLng: number) => Prisma.sql`
  CASE
    WHEN r.latitude IS NOT NULL AND r.longitude IS NOT NULL
    THEN GREATEST(0.0, 1.0 - (
      2 * 6371 * ASIN(SQRT(
        POWER(SIN((RADIANS(r.latitude) - RADIANS(${userLat})) / 2), 2) +
        COS(RADIANS(${userLat})) * COS(RADIANS(r.latitude)) *
        POWER(SIN((RADIANS(r.longitude) - RADIANS(${userLng})) / 2), 2)
      ))
    ) / 20.0)
    ELSE 0.0
  END
`

// ─── Query: FTS + GPS ─────────────────────────────────────────

async function queryWithFTS_GPS(
  dishId: string,
  query: string,
  cityFilter: Prisma.Sql,
  userLat: number,
  userLng: number,
  limit: number,
  offset: number,
): Promise<{ results: DishRestaurantResult[]; total: number }> {
  const prox = proximityExpr(userLat, userLng)
  const [rows, countRows] = await Promise.all([
    db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        ${baseSelect},
        (
          ts_rank_cd(r."searchVector",
            websearch_to_tsquery('english', unaccent(${query})))    * 0.35
          + ${prox}                                                  * 0.25
          + CAST(r."confidenceScore" AS float8)                     * 0.20
          + CASE rd."availabilityStatus"::text
              WHEN 'ALWAYS_AVAILABLE' THEN 0.12
              WHEN 'WEEKEND_ONLY'     THEN 0.08
              WHEN 'SEASONAL'         THEN 0.06
              WHEN 'ON_ORDER'         THEN 0.04
              ELSE 0.00
            END
          + CASE
              WHEN r."updatedAt" > NOW() - INTERVAL '30 days' THEN 0.08
              WHEN r."updatedAt" > NOW() - INTERVAL '90 days' THEN 0.04
              ELSE 0.00
            END
        )                                                           AS "displayScore"
      ${joinAndWhere(dishId, cityFilter)}
      ORDER BY "displayScore" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    db.$queryRaw<[{ total: bigint }]>(countQuery(dishId, cityFilter)),
  ])

  return {
    results: rows.map((r) => toResult(r, userLat, userLng)),
    total: Number(countRows[0]?.total ?? 0),
  }
}

// ─── Query: FTS only ──────────────────────────────────────────

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
        ${baseSelect},
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
      ${joinAndWhere(dishId, cityFilter)}
      ORDER BY "displayScore" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    db.$queryRaw<[{ total: bigint }]>(countQuery(dishId, cityFilter)),
  ])

  return {
    results: rows.map((r) => toResult(r)),
    total: Number(countRows[0]?.total ?? 0),
  }
}

// ─── Query: no FTS + GPS ──────────────────────────────────────

async function queryWithoutFTS_GPS(
  dishId: string,
  cityFilter: Prisma.Sql,
  userLat: number,
  userLng: number,
  limit: number,
  offset: number,
): Promise<{ results: DishRestaurantResult[]; total: number }> {
  const prox = proximityExpr(userLat, userLng)
  const [rows, countRows] = await Promise.all([
    db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        ${baseSelect},
        (
          ${prox}                                                    * 0.40
          + CAST(r."confidenceScore" AS float8)                     * 0.30
          + CASE rd."availabilityStatus"::text
              WHEN 'ALWAYS_AVAILABLE' THEN 0.18
              WHEN 'WEEKEND_ONLY'     THEN 0.12
              WHEN 'SEASONAL'         THEN 0.09
              WHEN 'ON_ORDER'         THEN 0.06
              ELSE 0.00
            END
          + CASE
              WHEN r."updatedAt" > NOW() - INTERVAL '30 days' THEN 0.12
              WHEN r."updatedAt" > NOW() - INTERVAL '90 days' THEN 0.06
              ELSE 0.00
            END
        )                                                           AS "displayScore"
      ${joinAndWhere(dishId, cityFilter)}
      ORDER BY "displayScore" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    db.$queryRaw<[{ total: bigint }]>(countQuery(dishId, cityFilter)),
  ])

  return {
    results: rows.map((r) => toResult(r, userLat, userLng)),
    total: Number(countRows[0]?.total ?? 0),
  }
}

// ─── Query: no FTS, no GPS ────────────────────────────────────

async function queryWithoutFTS(
  dishId: string,
  cityFilter: Prisma.Sql,
  limit: number,
  offset: number,
): Promise<{ results: DishRestaurantResult[]; total: number }> {
  const [rows, countRows] = await Promise.all([
    db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        ${baseSelect},
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
      ${joinAndWhere(dishId, cityFilter)}
      ORDER BY "displayScore" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    db.$queryRaw<[{ total: bigint }]>(countQuery(dishId, cityFilter)),
  ])

  return {
    results: rows.map((r) => toResult(r)),
    total: Number(countRows[0]?.total ?? 0),
  }
}

// ─── Serialisation ────────────────────────────────────────────

function toResult(row: RawRow, userLat?: number, userLng?: number): DishRestaurantResult {
  const distanceKm =
    userLat !== undefined &&
    userLng !== undefined &&
    row.latitude !== null &&
    row.longitude !== null
      ? haversineKm(userLat, userLng, row.latitude, row.longitude)
      : null

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
    distanceKm,
  }
}

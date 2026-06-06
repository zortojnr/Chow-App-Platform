// Discovery Service — Step 9
//
// Provides the three discovery data feeds for the home page:
//   getPopularDishes    — top searched dishes in the last 30 days (or 7 days)
//   getTrendingDishes   — dishes gaining search momentum this week
//   getJustVerified     — most recently verified RestaurantDish records (dish-first)
//
// All three methods are wrapped in unstable_cache (60s TTL).
// Failures return [] — discovery is an enhancement; a failed section is silently omitted.
//
// Fallback rule for popular/trending (§4.9):
//   If fewer than 4 dishes match from SearchLog, pad with alphabetical dishes
//   from DishTaxonomy to reach at least 4.
//
// Governed by: track-04-search-discovery.md §4, §14.2, §16 Step 9

import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { DishCategory, DishAvailabilityStatus } from '@prisma/client'
import { db } from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────

export type PopularDishResult = {
  dishId: string
  canonicalName: string
  slug: string
  category: DishCategory
  searchCount: number
  restaurantCount: number
}

export type TrendingDishResult = {
  dishId: string
  canonicalName: string
  slug: string
  category: DishCategory
  searchCount: number
  restaurantCount: number
}

export type JustVerifiedResult = {
  dishId: string
  canonicalName: string
  slug: string
  category: DishCategory
  restaurantDishId: string
  nameAsServed: string | null
  availabilityStatus: DishAvailabilityStatus
  price: string | null
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  city: string
  area: string | null
  verifiedAt: string    // ISO-8601
}

// ─── Raw row types ────────────────────────────────────────────

type PopularRow = {
  dishId: string
  canonicalName: string
  slug: string
  category: string
  searchCount: number | bigint
  restaurantCount: number | bigint
}

type JustVerifiedRow = {
  dishId: string
  canonicalName: string
  slug: string
  category: string
  restaurantDishId: string
  nameAsServed: string | null
  availabilityStatus: string
  price: string | null
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  city: string
  area: string | null
  verifiedAt: Date | string
}

// ─── Internal fetch functions ─────────────────────────────────

async function fetchPopularDishes(
  location: string | null,
  window: '7d' | '30d',
  limit: number,
): Promise<PopularDishResult[]> {
  const intervalSql = window === '7d'
    ? Prisma.sql`INTERVAL '7 days'`
    : Prisma.sql`INTERVAL '30 days'`

  const locationFilter = location
    ? Prisma.sql`AND sl.location = ${location}`
    : Prisma.sql``

  const locationRestFilter = location
    ? Prisma.sql`AND r.city ILIKE ${location}`
    : Prisma.sql``

  try {
    const rows = await db.$queryRaw<PopularRow[]>(Prisma.sql`
      SELECT
        dt.id                   AS "dishId",
        dt."canonicalName",
        dt.slug,
        dt.category::text       AS category,
        agg.search_count::int   AS "searchCount",
        COALESCE(rc.cnt, 0)     AS "restaurantCount"
      FROM (
        SELECT LOWER(TRIM(query)) AS nq, COUNT(*)::int AS search_count
        FROM "SearchLog" sl
        WHERE sl."createdAt" > NOW() - ${intervalSql}
          ${locationFilter}
        GROUP BY nq
        ORDER BY search_count DESC
        LIMIT 20
      ) agg
      JOIN "DishTaxonomy" dt ON (
        LOWER(dt."canonicalName") = agg.nq
        OR EXISTS (
          SELECT 1 FROM unnest(dt.aliases) AS alias_val
          WHERE LOWER(alias_val) = agg.nq
        )
      )
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM "RestaurantDish" rd
        JOIN "Restaurant" r ON r.id = rd."restaurantId"
        WHERE rd."dishId" = dt.id
          AND rd."deletedAt" IS NULL
          AND r."verificationStatus"::text = 'APPROVED'
          AND r."deletedAt" IS NULL
          ${locationRestFilter}
      ) rc ON true
      WHERE dt."isActive" = true
      ORDER BY agg.search_count DESC
      LIMIT ${limit}
    `)

    const results = rows.map(toPopularResult)

    // Pad with alphabetical fallback if fewer than 4 matches (§4.9)
    if (results.length < 4) {
      const existingIds = results.map(r => r.dishId)
      const fallback = await fetchFallbackDishes(existingIds, location, limit - results.length)
      return [...results, ...fallback]
    }

    return results
  } catch {
    return []
  }
}

async function fetchTrendingDishes(
  location: string | null,
  limit: number,
  excludeDishIds: string[],
): Promise<TrendingDishResult[]> {
  const locationFilter = location
    ? Prisma.sql`AND sl.location = ${location}`
    : Prisma.sql``

  const locationRestFilter = location
    ? Prisma.sql`AND r.city ILIKE ${location}`
    : Prisma.sql``

  try {
    const rows = await db.$queryRaw<PopularRow[]>(Prisma.sql`
      SELECT
        dt.id                 AS "dishId",
        dt."canonicalName",
        dt.slug,
        dt.category::text     AS category,
        agg.search_count::int AS "searchCount",
        COALESCE(rc.cnt, 0)   AS "restaurantCount"
      FROM (
        SELECT
          LOWER(TRIM(query)) AS nq,
          COUNT(*)::int AS search_count,
          COUNT(*) FILTER (
            WHERE "createdAt" > NOW() - INTERVAL '3 days'
          )::int AS recent_count
        FROM "SearchLog" sl
        WHERE sl."createdAt" > NOW() - INTERVAL '7 days'
          ${locationFilter}
        GROUP BY nq
        ORDER BY (
          COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '3 days') * 2.0
          + COUNT(*)
        ) DESC
        LIMIT 20
      ) agg
      JOIN "DishTaxonomy" dt ON (
        LOWER(dt."canonicalName") = agg.nq
        OR EXISTS (
          SELECT 1 FROM unnest(dt.aliases) AS alias_val
          WHERE LOWER(alias_val) = agg.nq
        )
      )
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM "RestaurantDish" rd
        JOIN "Restaurant" r ON r.id = rd."restaurantId"
        WHERE rd."dishId" = dt.id
          AND rd."deletedAt" IS NULL
          AND r."verificationStatus"::text = 'APPROVED'
          AND r."deletedAt" IS NULL
          ${locationRestFilter}
      ) rc ON true
      WHERE dt."isActive" = true
      ORDER BY agg.search_count DESC
    `)

    const results = rows
      .map(toPopularResult)
      .filter(r => !excludeDishIds.includes(r.dishId))
      .slice(0, limit)

    return results
  } catch {
    return []
  }
}

async function fetchJustVerified(
  location: string | null,
  limit: number,
): Promise<JustVerifiedResult[]> {
  const locationFilter = location
    ? Prisma.sql`AND r.city ILIKE ${location}`
    : Prisma.sql``

  try {
    const rows = await db.$queryRaw<JustVerifiedRow[]>(Prisma.sql`
      SELECT
        dt.id                             AS "dishId",
        dt."canonicalName",
        dt.slug,
        dt.category::text                 AS category,
        rd.id                             AS "restaurantDishId",
        rd."nameAsServed",
        rd."availabilityStatus"::text     AS "availabilityStatus",
        rd.price::text                    AS price,
        r.id                              AS "restaurantId",
        r.name                            AS "restaurantName",
        r.slug                            AS "restaurantSlug",
        r.city,
        r.area,
        rd."verifiedAt"
      FROM "RestaurantDish" rd
      JOIN "DishTaxonomy" dt ON dt.id = rd."dishId"
      JOIN "Restaurant" r ON r.id = rd."restaurantId"
      WHERE rd."verifiedAt" IS NOT NULL
        AND rd."deletedAt" IS NULL
        AND r."verificationStatus"::text = 'APPROVED'
        AND r."deletedAt" IS NULL
        AND dt."isActive" = true
        ${locationFilter}
      ORDER BY rd."verifiedAt" DESC
      LIMIT ${limit}
    `)

    return rows.map(toJustVerifiedResult)
  } catch {
    return []
  }
}

// Alphabetical fallback dishes (§4.9) — searchCount=0, restaurantCount=0
async function fetchFallbackDishes(
  excludeIds: string[],
  location: string | null,
  count: number,
): Promise<PopularDishResult[]> {
  if (count <= 0) return []

  const locationRestFilter = location
    ? Prisma.sql`AND r.city ILIKE ${location}`
    : Prisma.sql``

  // Build NOT IN clause — safe because these are internal UUIDs from our own DB queries
  const excludeFilter = excludeIds.length > 0
    ? Prisma.sql`AND dt.id NOT IN (${Prisma.join(excludeIds.map(id => Prisma.sql`${id}`))})`
    : Prisma.sql``

  try {
    const rows = await db.$queryRaw<PopularRow[]>(Prisma.sql`
      SELECT
        dt.id               AS "dishId",
        dt."canonicalName",
        dt.slug,
        dt.category::text   AS category,
        0::int              AS "searchCount",
        COALESCE(rc.cnt, 0) AS "restaurantCount"
      FROM "DishTaxonomy" dt
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM "RestaurantDish" rd
        JOIN "Restaurant" r ON r.id = rd."restaurantId"
        WHERE rd."dishId" = dt.id
          AND rd."deletedAt" IS NULL
          AND r."verificationStatus"::text = 'APPROVED'
          AND r."deletedAt" IS NULL
          ${locationRestFilter}
      ) rc ON true
      WHERE dt."isActive" = true
        ${excludeFilter}
      ORDER BY dt."canonicalName" ASC
      LIMIT ${count}
    `)

    return rows.map(toPopularResult)
  } catch {
    return []
  }
}

// ─── Serialisation ────────────────────────────────────────────

function toPopularResult(row: PopularRow): PopularDishResult {
  return {
    dishId: row.dishId,
    canonicalName: row.canonicalName,
    slug: row.slug,
    category: row.category as DishCategory,
    searchCount: Number(row.searchCount),
    restaurantCount: Number(row.restaurantCount),
  }
}

function toJustVerifiedResult(row: JustVerifiedRow): JustVerifiedResult {
  return {
    dishId: row.dishId,
    canonicalName: row.canonicalName,
    slug: row.slug,
    category: row.category as DishCategory,
    restaurantDishId: row.restaurantDishId,
    nameAsServed: row.nameAsServed,
    availabilityStatus: row.availabilityStatus as DishAvailabilityStatus,
    price: row.price,
    restaurantId: row.restaurantId,
    restaurantName: row.restaurantName,
    restaurantSlug: row.restaurantSlug,
    city: row.city,
    area: row.area,
    verifiedAt: row.verifiedAt instanceof Date
      ? row.verifiedAt.toISOString()
      : String(row.verifiedAt),
  }
}

// ─── Cached public API ────────────────────────────────────────

const cachedGetPopularDishes = unstable_cache(
  fetchPopularDishes,
  ['discovery-popular-dishes'],
  { revalidate: 60 },
)

const cachedGetTrendingDishes = unstable_cache(
  fetchTrendingDishes,
  ['discovery-trending-dishes'],
  { revalidate: 60 },
)

const cachedGetJustVerified = unstable_cache(
  fetchJustVerified,
  ['discovery-just-verified'],
  { revalidate: 60 },
)

// ─── Public API ───────────────────────────────────────────────

export const DiscoveryService = {
  getPopularDishes(opts: {
    location?: string
    window?: '7d' | '30d'
    limit?: number
  } = {}): Promise<PopularDishResult[]> {
    return cachedGetPopularDishes(
      opts.location ?? null,
      opts.window ?? '30d',
      opts.limit ?? 8,
    )
  },

  getTrendingDishes(opts: {
    location?: string
    limit?: number
    excludeDishIds?: string[]
  } = {}): Promise<TrendingDishResult[]> {
    return cachedGetTrendingDishes(
      opts.location ?? null,
      opts.limit ?? 8,
      opts.excludeDishIds ?? [],
    )
  },

  getJustVerified(opts: {
    location?: string
    limit?: number
  } = {}): Promise<JustVerifiedResult[]> {
    return cachedGetJustVerified(
      opts.location ?? null,
      opts.limit ?? 6,
    )
  },
}

// Dish Search Service — Step 2
//
// Two-stage search for DishTaxonomy records:
//   Stage 1: PostgreSQL FTS via websearch_to_tsquery + unaccent
//   Stage 2: pg_trgm similarity fallback when FTS returns zero results
//
// Alias resolution is handled automatically — aliases are indexed at
// weight B in the dish FTS trigger (migration 010). No separate query needed.
//
// Governed by: track-04-search-discovery.md §3, search-system-track.md §3
// DB: $queryRaw — FTS and trigram queries require raw SQL; Prisma ORM has no
//     native websearch_to_tsquery or similarity() support.

import { Prisma } from '@prisma/client'
import type { DishCategory } from '@prisma/client'
import { db } from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────

export type DishSearchResult = {
  dishId: string
  canonicalName: string
  slug: string
  category: DishCategory
  aliases: string[]
  restaurantCount: number
  matchScore: number
}

// Prisma raw returns category as text, restaurantCount as BigInt or number
type RawDishRow = {
  dishId: string
  canonicalName: string
  slug: string
  category: string
  aliases: string[]
  restaurantCount: bigint | number
  matchScore: number | string
}

// ─── Public API ───────────────────────────────────────────────

export const DishSearchService = {
  /**
   * Searches dishes by query string. Returns ranked DishSearchResult[].
   * - Stage 1: FTS via websearch_to_tsquery (weights: A canonical, B aliases)
   * - Stage 2: pg_trgm trigram fallback when FTS returns zero results
   * - Never throws on malformed queries — returns [] on error
   */
  async search(
    query: string,
    options: { category?: DishCategory; limit?: number } = {},
  ): Promise<DishSearchResult[]> {
    const { category, limit = 20 } = options
    const trimmed = query.trim().slice(0, 200)
    if (trimmed.length < 2) return []

    try {
      const fts = await runFTS(trimmed, category, limit)
      if (fts.length > 0) return fts
      return runTrigram(trimmed, category, limit)
    } catch {
      // Malformed query or DB error — return empty, never propagate
      return []
    }
  },
}

// ─── Stage 1: FTS ────────────────────────────────────────────

async function runFTS(
  query: string,
  category: DishCategory | undefined,
  limit: number,
): Promise<DishSearchResult[]> {
  const catFilter = category
    ? Prisma.sql`AND d.category::text = ${category}`
    : Prisma.sql``

  const rows = await db.$queryRaw<RawDishRow[]>(Prisma.sql`
    SELECT
      d.id                                                        AS "dishId",
      d."canonicalName",
      d.slug,
      d.category::text                                           AS category,
      d.aliases,
      ts_rank_cd(d."searchVector",
        websearch_to_tsquery('english', unaccent(${query})))     AS "matchScore",
      COALESCE(rc.cnt, 0)                                        AS "restaurantCount"
    FROM "DishTaxonomy" d
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt
      FROM "RestaurantDish" rd
      JOIN "Restaurant" r ON r.id = rd."restaurantId"
      WHERE rd."dishId" = d.id
        AND rd."deletedAt" IS NULL
        AND r."verificationStatus"::text = 'APPROVED'
        AND r."deletedAt" IS NULL
    ) rc ON true
    WHERE d."isActive" = true
      ${catFilter}
      AND d."searchVector" @@ websearch_to_tsquery('english', unaccent(${query}))
    ORDER BY "matchScore" DESC
    LIMIT ${limit}
  `)

  return rows.map(toResult)
}

// ─── Stage 2: Trigram fallback ────────────────────────────────

async function runTrigram(
  query: string,
  category: DishCategory | undefined,
  limit: number,
): Promise<DishSearchResult[]> {
  const catFilter = category
    ? Prisma.sql`AND d.category::text = ${category}`
    : Prisma.sql``

  const rows = await db.$queryRaw<RawDishRow[]>(Prisma.sql`
    SELECT
      d.id                                          AS "dishId",
      d."canonicalName",
      d.slug,
      d.category::text                             AS category,
      d.aliases,
      similarity(d."canonicalName", ${query})       AS "matchScore",
      COALESCE(rc.cnt, 0)                           AS "restaurantCount"
    FROM "DishTaxonomy" d
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt
      FROM "RestaurantDish" rd
      JOIN "Restaurant" r ON r.id = rd."restaurantId"
      WHERE rd."dishId" = d.id
        AND rd."deletedAt" IS NULL
        AND r."verificationStatus"::text = 'APPROVED'
        AND r."deletedAt" IS NULL
    ) rc ON true
    WHERE d."isActive" = true
      ${catFilter}
      AND similarity(d."canonicalName", ${query}) > 0.3
    ORDER BY "matchScore" DESC
    LIMIT ${limit}
  `)

  return rows.map(toResult)
}

// ─── Serialisation ────────────────────────────────────────────

function toResult(row: RawDishRow): DishSearchResult {
  return {
    dishId: row.dishId,
    canonicalName: row.canonicalName,
    slug: row.slug,
    category: row.category as DishCategory,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    restaurantCount: Number(row.restaurantCount),
    matchScore: Number(row.matchScore),
  }
}

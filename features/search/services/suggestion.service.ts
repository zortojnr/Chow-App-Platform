// Suggestion Service — Step 6
//
// Prefix autocomplete for the search bar idle and active states.
// Returns max 8 results ordered by canonical match first, alias match second.
//
// Two match types:
//   Canonical: DishTaxonomy.canonicalName ILIKE :prefix%
//   Alias:     any element of DishTaxonomy.aliases ILIKE :prefix%
//
// Minimum 2 characters required — enforced here, not just at the API layer.
// Results include aliasMatched flag so the UI can show the alias hint line.
//
// Governed by: track-04-search-discovery.md §3.3, §10.3

import { Prisma } from '@prisma/client'
import type { DishCategory } from '@prisma/client'
import { db } from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────

export type SuggestionResult = {
  dishId: string
  canonicalName: string
  slug: string
  category: DishCategory
  aliasMatched: boolean
  aliasValue: string | null   // the specific alias that matched (for the hint line)
}

type RawSuggestionRow = {
  dishId: string
  canonicalName: string
  slug: string
  category: string
  aliasMatched: boolean
  aliasValue: string | null
}

// ─── Public API ───────────────────────────────────────────────

export const SuggestionService = {
  /**
   * Returns up to 8 autocomplete suggestions for the given prefix.
   * Returns [] when prefix < 2 chars. Never throws.
   */
  async suggest(prefix: string): Promise<SuggestionResult[]> {
    const trimmed = prefix.trim()
    if (trimmed.length < 2) return []

    const prefixPattern = `${trimmed}%`

    try {
      const rows = await db.$queryRaw<RawSuggestionRow[]>(Prisma.sql`
        SELECT
          d.id                        AS "dishId",
          d."canonicalName",
          d.slug,
          d.category::text            AS category,
          -- canonical match: true when name starts with prefix
          (d."canonicalName" ILIKE ${prefixPattern}) AS "aliasMatched",
          -- aliasValue: the matching alias, null when canonical matched
          CASE
            WHEN d."canonicalName" ILIKE ${prefixPattern} THEN NULL
            ELSE (
              SELECT alias
              FROM unnest(d.aliases) AS alias
              WHERE alias ILIKE ${prefixPattern}
              LIMIT 1
            )
          END AS "aliasValue"
        FROM "DishTaxonomy" d
        WHERE d."isActive" = true
          AND (
            d."canonicalName" ILIKE ${prefixPattern}
            OR EXISTS (
              SELECT 1 FROM unnest(d.aliases) AS alias
              WHERE alias ILIKE ${prefixPattern}
            )
          )
        -- canonical matches first, then alias matches, then alphabetical
        ORDER BY
          (d."canonicalName" ILIKE ${prefixPattern}) DESC,
          d."canonicalName"
        LIMIT 8
      `)

      return rows.map((row) => ({
        dishId: row.dishId,
        canonicalName: row.canonicalName,
        slug: row.slug,
        category: row.category as DishCategory,
        // aliasMatched = true when alias matched (not canonical)
        aliasMatched: !row.aliasMatched,   // aliasMatched col = (canonical ILIKE ...) so invert
        aliasValue: row.aliasValue,
      }))
    } catch {
      return []
    }
  },
}

// Duplicate Check Service
//
// Checks whether an incoming restaurant name+city combination conflicts with an
// existing active listing. Two modes:
//   EXACT_DUPLICATE    → case-insensitive exact match → reject at intake API (409)
//   POSSIBLE_DUPLICATE → pg_trgm similarity > 0.75 → allow through, flag for admin
//   CLEAR              → no conflict
//
// The fuzzy query requires the pg_trgm extension (database-track.md §2.4, migration 009).
// Raw SQL is used because Prisma does not expose similarity() natively.
// deleted_at IS NULL is applied manually in the raw query — extensions do not intercept $queryRaw.
//
// Governed by: restaurant-intake-track.md §5, backend-standards.md §3, security-standards.md §5.1

import { db } from '@/lib/db'

export type DuplicateCheckResult =
  | { status: 'CLEAR' }
  | { status: 'EXACT_DUPLICATE'; existingId: string; existingSlug: string }
  | {
      status: 'POSSIBLE_DUPLICATE'
      candidates: Array<{ id: string; name: string; similarity: number }>
    }

type FuzzyRow = { id: string; name: string; similarity: number }

/**
 * Returns EXACT_DUPLICATE if an active restaurant with the same name (case-insensitive)
 * exists in the same city. Returns POSSIBLE_DUPLICATE if pg_trgm similarity > 0.75.
 * Otherwise returns CLEAR.
 */
export async function checkForDuplicate(
  name: string,
  city: string,
): Promise<DuplicateCheckResult> {
  // 1. Exact match (case-insensitive, uses soft-delete filter from db extension)
  const exact = await db.restaurant.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, city },
    select: { id: true, slug: true },
  })
  if (exact) {
    return { status: 'EXACT_DUPLICATE', existingId: exact.id, existingSlug: exact.slug }
  }

  // 2. Fuzzy match — raw SQL required for pg_trgm similarity()
  const fuzzy = await db.$queryRaw<FuzzyRow[]>`
    SELECT id, name, similarity(name, ${name}) AS similarity
    FROM "Restaurant"
    WHERE city = ${city}
      AND deleted_at IS NULL
      AND similarity(name, ${name}) > 0.75
    ORDER BY similarity DESC
    LIMIT 5
  `
  if (fuzzy.length > 0) {
    return {
      status: 'POSSIBLE_DUPLICATE',
      candidates: fuzzy.map((r) => ({
        id: r.id,
        name: r.name,
        similarity: Number(r.similarity),
      })),
    }
  }

  return { status: 'CLEAR' }
}

// Slug Service — generates URL-safe slugs for restaurant listings.
//
// generateSlug:     pure function, no DB access.
// ensureUniqueSlug: queries the active-restaurant index via `db`.
//
// Note: the uniqueness check uses the soft-delete-filtered `db` client, which
// excludes deleted restaurants. A deleted restaurant's slug can therefore be
// reclaimed. If a race condition causes a unique constraint error on create,
// the intake route handler returns 500 — acceptable at Phase 1 submission volume.
//
// Governed by: restaurant-intake-track.md §2 (module location), backend-standards.md §3

import { db } from '@/lib/db'

/**
 * Converts a restaurant name to a URL-safe slug.
 *
 * 'Mama Titi Kitchen'  → 'mama-titi-kitchen'
 * "Koko's Bar & Grill" → 'kocos-bar-grill'
 * 'Café  Bénin'        → 'cafe-benin'
 */
export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritical marks (accents)
    .replace(/[^a-z0-9\s-]/g, '')   // strip everything except alphanumeric, spaces, hyphens
    .trim()
    .replace(/[\s-]+/g, '-')         // collapse whitespace runs and hyphens to a single hyphen
    .replace(/^-|-$/g, '')           // remove leading and trailing hyphens

  // Fallback in case the name produces an empty string (e.g. all special characters)
  return slug || 'restaurant'
}

/**
 * Returns a slug that does not conflict with any active restaurant in the database.
 * If `base` is taken, appends a numeric suffix: `base-2`, `base-3`, and so on.
 */
export async function ensureUniqueSlug(base: string): Promise<string> {
  const isTaken = async (candidate: string): Promise<boolean> => {
    const existing = await db.restaurant.findFirst({
      where: { slug: candidate },
      select: { id: true },
    })
    return existing !== null
  }

  if (!(await isTaken(base))) return base

  let n = 2
  while (true) {
    const candidate = `${base}-${n}`
    if (!(await isTaken(candidate))) return candidate
    n++
  }
}

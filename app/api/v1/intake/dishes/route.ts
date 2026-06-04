// GET /api/v1/intake/dishes?q=jollof&limit=20
//
// Typeahead search over active DishTaxonomy records. Used by the Step 2 dish selector
// on the intake form. Returns at most 20 results ordered by trigram similarity.
//
// Minimum query length: 2 characters — track-02-verification-intelligence.md §12 Step 10.
// Inactive dishes (isActive = false) are never returned.
//
// Governed by: restaurant-intake-track.md §8.3, backend-standards.md §1, §3.4, §7
//              search-architecture.md (FTS + pg_trgm pattern)

import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  errorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 20
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60 * 1000  // per minute

type DishRow = {
  id: string
  canonicalName: string
  category: string
  aliases: string[]
}

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)

    // 1. Rate limit
    const rl = await checkRateLimit(`dish_search:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    // 2. Validate query params
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')?.trim() ?? ''
    if (q.length < MIN_QUERY_LENGTH) {
      return errorResponse('VALIDATION_ERROR', 'Query must be at least 2 characters', 400)
    }
    const rawLimit = Number(searchParams.get('limit') ?? MAX_RESULTS)
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? MAX_RESULTS : rawLimit), MAX_RESULTS)

    // 3. FTS + trigram search — only active dishes
    //    $queryRaw is required for similarity() — not available via Prisma's query builder.
    //    Parameters are automatically escaped by the tagged template.
    const dishes = await db.$queryRaw<DishRow[]>`
      SELECT id, "canonicalName" AS "canonicalName", category::text AS category, aliases
      FROM "DishTaxonomy"
      WHERE "isActive" = true
        AND (
          search_vector @@ plainto_tsquery('english', ${q})
          OR "canonicalName" ILIKE ${'%' + q + '%'}
        )
      ORDER BY similarity("canonicalName", ${q}) DESC
      LIMIT ${limit}
    `

    return successResponse(dishes)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

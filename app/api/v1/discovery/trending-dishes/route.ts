// GET /api/v1/discovery/trending-dishes
//
// Dishes gaining search momentum over the last 7 days (acceleration-weighted).
// Used to populate the "Trending this week" home page section.
//
// The `exclude` param accepts comma-separated dishIds to deduplicate against
// the popular-dishes section (home page deduplication — §4.6).
// Delegates to DiscoveryService — no Prisma in this handler.
//
// Query params: location (optional), limit (default: 8, max: 20), exclude (optional)
// Rate: 30/IP/min
// Governed by: track-04-search-discovery.md §14.1, §4.6

import { type NextRequest } from 'next/server'
import { DiscoveryService } from 'features/search/services/discovery.service'
import { TrendingDishesQuerySchema } from 'features/search/schemas/search.schema'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const RATE_LIMIT     = 30
const RATE_WINDOW_MS = 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`discovery:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = TrendingDishesQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { location, limit, exclude } = parsed.data

    // Parse comma-separated exclude param into an array
    const excludeDishIds = exclude
      ? exclude.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const dishes = await DiscoveryService.getTrendingDishes({
      location,
      limit,
      excludeDishIds,
    })

    return successResponse({ dishes, location: location ?? null })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

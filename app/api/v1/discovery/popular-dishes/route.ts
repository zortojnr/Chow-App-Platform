// GET /api/v1/discovery/popular-dishes
//
// Top searched dishes in the given location over the last 30 days (default)
// or 7 days. Used to populate the "Popular in [City]" home page section.
// Delegates to DiscoveryService — no Prisma in this handler.
//
// Query params: location (optional), limit (default: 8, max: 20), window (default: "30d")
// Rate: 30/IP/min
// Governed by: track-04-search-discovery.md §14.1, §14.2, §4.9

import { type NextRequest } from 'next/server'
import { DiscoveryService } from 'features/search/services/discovery.service'
import { PopularDishesQuerySchema } from 'features/search/schemas/search.schema'
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
    const parsed = PopularDishesQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { location, limit, window } = parsed.data

    const dishes = await DiscoveryService.getPopularDishes({ location, limit, window })

    return successResponse({ dishes, location: location ?? null, window })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

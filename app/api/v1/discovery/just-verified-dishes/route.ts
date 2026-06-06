// GET /api/v1/discovery/just-verified-dishes
//
// Most recently verified RestaurantDish records (dish-first shape).
// Used to populate the "Just Verified" home page section (§4.4).
//
// Response is dish-first: the dish name is the primary identifier.
// The restaurant is secondary context.
// Delegates to DiscoveryService — no Prisma in this handler.
//
// Query params: location (optional), limit (default: 6, max: 8)
// Rate: 30/IP/min
// Governed by: track-04-search-discovery.md §14.1, §4.4, §4.5

import { type NextRequest } from 'next/server'
import { DiscoveryService } from 'features/search/services/discovery.service'
import { JustVerifiedQuerySchema } from 'features/search/schemas/search.schema'
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
    const parsed = JustVerifiedQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { location, limit } = parsed.data

    const dishes = await DiscoveryService.getJustVerified({ location, limit })

    return successResponse({ dishes, location: location ?? null })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

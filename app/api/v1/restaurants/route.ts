// GET /api/v1/restaurants
//
// Public browse index of APPROVED restaurants. No authentication required.
// Optional filters: city (case-insensitive), priceRange.
// Pagination: page (default 1), limit (default 12, max 20).
//
// Returns consumer-safe RestaurantCardResponse shapes only — no raw
// confidence scores, no admin-internal fields.
//
// Rate: 60/IP/min
// Governed by: restaurant-listing-track.md §12.4, §5.1, §7.2
//              backend-standards.md §1, §3.4, security-standards.md §6.1a

import { type NextRequest } from 'next/server'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'
import { RestaurantIndexQuerySchema } from 'features/restaurants/schemas/restaurant-index.schema'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  paginatedSuccessResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const RATE_LIMIT     = 60
const RATE_WINDOW_MS = 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`restaurants:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = RestaurantIndexQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await RestaurantListingService.getRestaurantIndex(parsed.data)

    return paginatedSuccessResponse(result.restaurants, {
      total: result.total,
      page:  result.page,
      limit: result.limit,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

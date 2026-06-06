// GET /api/v1/restaurants/:slug/dishes
//
// Returns a paginated list of consumer-safe dishes for an APPROVED restaurant.
//
// Two-step delegation pattern (both calls stay within RestaurantListingService):
//   1. getRestaurantProfile(slug)   — resolves slug → ID, enforces APPROVED gate.
//      Returns null for unknown slug AND non-approved restaurant. Both map to 404
//      with identical response bodies — no disclosure of pipeline existence.
//   2. getRestaurantDishes(id, params) — paginated dishes for the resolved ID.
//      Has its own APPROVED guard as a defence-in-depth check.
//
// No direct Prisma access. No admin fields. No verification internals.
//
// Auth:   none
// Rate:   60/IP/min
// Governed by: restaurant-listing-track.md §12.3, §5.1
//              backend-standards.md §1, §3.4, security-standards.md §6.1a

import { type NextRequest } from 'next/server'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'
import { RestaurantDishesQuerySchema } from 'features/restaurants/schemas/restaurant-dishes.schema'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  paginatedSuccessResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response'

const RATE_LIMIT     = 60
const RATE_WINDOW_MS = 60 * 1000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`restaurant-dishes:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    // 1. Resolve slug → ID, enforce APPROVED gate
    const restaurant = await RestaurantListingService.getRestaurantProfile(slug)
    if (!restaurant) return errorResponse('NOT_FOUND', 'Restaurant not found', 404)

    // 2. Parse and validate query params
    const { searchParams } = new URL(request.url)
    const parsed = RestaurantDishesQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    // 3. Fetch paginated dishes
    const result = await RestaurantListingService.getRestaurantDishes(restaurant.id, parsed.data)
    if (!result) return errorResponse('NOT_FOUND', 'Restaurant not found', 404)

    return paginatedSuccessResponse(result.dishes, {
      total: result.total,
      page:  result.page,
      limit: result.limit,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

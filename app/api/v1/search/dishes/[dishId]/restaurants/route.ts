// GET /api/v1/search/dishes/[dishId]/restaurants
//
// Returns ranked restaurants serving the given dish.
// `dishId` is a DishTaxonomy.id (UUID). Unrecognised IDs return an empty list.
// Delegates to DishRestaurantService — no Prisma in this handler.
//
// Query params: q (optional context query), city, area, page (default: 1)
// Rate: 60/IP/min
// Governed by: track-04-search-discovery.md §14.1, §5.1, §7.2

import { type NextRequest } from 'next/server'
import { DishRestaurantService } from 'features/search/services/dish-restaurant.service'
import { DishRestaurantsQuerySchema } from 'features/search/schemas/search.schema'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const RATE_LIMIT     = 60
const RATE_WINDOW_MS = 60 * 1000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> },
) {
  const { dishId } = await params
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`search:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = DishRestaurantsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { q, city, area, page } = parsed.data

    const { results, total } = await DishRestaurantService.getDishRestaurants(
      dishId,
      q,
      { city, area, page },
    )

    return successResponse({ restaurants: results, total, page })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

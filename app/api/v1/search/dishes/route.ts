// GET /api/v1/search/dishes
//
// Dish taxonomy search with optional category filter.
// Delegates to DishSearchService — no Prisma in this handler.
//
// Query params: q (required), category (optional), limit (default: 8, max: 20)
// Rate: 60/IP/min
// Governed by: track-04-search-discovery.md §14.1

import { type NextRequest } from 'next/server'
import { DishSearchService } from 'features/search/services/dish-search.service'
import { DishSearchQuerySchema } from 'features/search/schemas/search.schema'
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

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`search:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = DishSearchQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { q, category, limit } = parsed.data

    const dishes = await DishSearchService.search(q, { category, limit })

    return successResponse(dishes)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

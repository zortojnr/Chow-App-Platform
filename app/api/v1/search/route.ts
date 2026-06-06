// GET /api/v1/search
//
// Universal search: dishes + restaurants (or either alone via `type` param).
// Delegates entirely to SearchService — no Prisma in this handler.
//
// Fire-and-forget search log is written after the response is built.
// It does not affect response time.
//
// Query params: q (required), type (default: all), city, area, page (default: 1)
// Rate: 60/IP/min
// Governed by: track-04-search-discovery.md §14.1, §3.2, §8.1

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SearchService } from 'features/search/services/search.service'
import { SearchLogService } from 'features/search/services/search-log.service'
import { SearchQuerySchema } from 'features/search/schemas/search.schema'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const RATE_LIMIT      = 60
const RATE_WINDOW_MS  = 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`search:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = SearchQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { q, type, city, area, page } = parsed.data

    // JWT validation — fast (no DB call). Provides userId for authenticated searches.
    const session = await getServerSession(authOptions)
    const userId  = session?.user?.id ?? undefined

    const result = await SearchService.search({ query: q, type, city, area, page })

    // Fire-and-forget — never awaited
    // userId present → also writes UserSearchHistory (§8.1)
    SearchLogService.log({
      query: q,
      location: city ?? null,
      resultCount: result.total,
      userId,
    })

    return successResponse(result)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

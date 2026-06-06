// GET /api/v1/search/suggestions
//
// Autocomplete prefix suggestions from DishTaxonomy canonical names and aliases.
// Minimum 2 characters enforced — returns [] for shorter prefixes (enforced in schema).
// Delegates to SuggestionService — no Prisma in this handler.
//
// Query params: q (required, min 2 chars)
// Rate: 120/IP/min (higher limit — called on every keystroke)
// Governed by: track-04-search-discovery.md §14.1, §3.3

import { type NextRequest } from 'next/server'
import { SuggestionService } from 'features/search/services/suggestion.service'
import { SuggestionsQuerySchema } from 'features/search/schemas/search.schema'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const RATE_LIMIT     = 120
const RATE_WINDOW_MS = 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`suggestions:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = SuggestionsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const suggestions = await SuggestionService.suggest(parsed.data.q)

    return successResponse(suggestions)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

// POST /api/v1/intake/restaurants
//
// Accepts a restaurant submission from the public. Anonymous submissions allowed.
// Validates, rate-limits, delegates entirely to IntakeService.
//
// Malformed JSON → 400. Validation failure → 422. Duplicate → 409. Rate limit → 429.
//
// Governed by: restaurant-intake-track.md §8.1, backend-standards.md §1, §7
//              security-standards.md §3.2, §6.1a

import { type NextRequest } from 'next/server'
import { IntakeSubmissionSchema } from 'features/restaurants/schemas/intake.schema'
import { IntakeService } from 'features/restaurants/services/intake.service'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

// 3 submissions per IP per hour — restaurant-intake-track.md §8.1
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 60 * 60 * 1000

function extractIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    '127.0.0.1'
  )
}

export async function POST(request: NextRequest) {
  try {
    const ip = extractIp(request)

    // 1. Rate limit — runs before any parsing
    const rl = await checkRateLimit(`intake:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    // 2. Parse JSON — malformed JSON is a client error (400), not a server error
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
    }

    // 3. Validate
    const parsed = IntakeSubmissionSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    // 4. Submit
    const result = await IntakeService.submit(parsed.data, ip)

    return successResponse({ submissionId: result.submissionId }, 201)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

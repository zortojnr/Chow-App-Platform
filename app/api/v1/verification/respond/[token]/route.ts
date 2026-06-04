// POST /api/v1/verification/respond/[token]
//
// Accepts a submitter's response to a NEEDS_INFO request.
// Auth is token-based (signed JWT in the URL path) — no session required.
//
// Token validation order (approved in Step 13 architecture review):
//   1. Rate limit — keyed by respond:<sha256(token)> (10 per token per hour)
//   2. Body validation — Zod → 422 on failure
//   3. validateResponseToken() — 400 TOKEN_EXPIRED / TOKEN_INVALID
//   4. isTokenUsed()            — 410 TOKEN_USED
//   5. VerificationService.processSubmitterResponse() — transition + token
//      consumption inside a single atomic transaction
//
// Error codes:
//   400 TOKEN_EXPIRED   — token window has closed
//   400 TOKEN_INVALID   — tampered, wrong environment, or not a valid JWT
//   410 TOKEN_USED      — token was already consumed
//   422 VALIDATION_ERROR — body did not pass Zod schema
//   429 RATE_LIMIT_EXCEEDED
//
// Governed by: track-02-verification-intelligence.md §4.4, §7.3, §9.2, §12 Step 13

import { type NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import { hashToken, validateResponseToken, isTokenUsed } from 'features/verification/services/response-token.service'
import { VerificationService } from 'features/verification'
import { SubmitterResponseSchema } from 'features/verification/schemas/response.schema'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const { token } = params

  try {
    // Step 1 — rate limit keyed by token hash (not IP) to prevent brute-force scanning
    const rl = await checkRateLimit(`respond:${hashToken(token)}`, 10, 60 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    // Step 2 — body validation
    let body: unknown
    try { body = await request.json() } catch {
      return errorResponse('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
    }

    const parsed = SubmitterResponseSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    // Step 3 — token signature and expiry
    const validation = await validateResponseToken(token)
    if (!validation.valid) {
      const code = validation.reason === 'EXPIRED' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
      const message =
        validation.reason === 'EXPIRED'
          ? 'This response link has expired'
          : 'This response link is not valid'
      return errorResponse(code, message, 400)
    }

    // Step 4 — replay check
    if (await isTokenUsed(token)) {
      return errorResponse('TOKEN_USED', 'This response link has already been used', 410)
    }

    // Step 5 — delegate orchestration; service handles transition + token consumption atomically
    await VerificationService.processSubmitterResponse({
      token,
      responseText:       parsed.data.responseText,
      additionalPhotoIds: parsed.data.additionalPhotoIds,
      ipAddress:          extractIp(request),
    })

    return successResponse({
      message: 'Response received. Your submission has re-entered the review queue.',
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

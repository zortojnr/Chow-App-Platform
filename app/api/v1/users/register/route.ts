// POST /api/v1/users/register
//
// Public self-service account creation. No admin approval step, unlike
// restaurant intake — see track-05-user-accounts.md §4.2, §8.2.
//
// Rate: 5/IP/hour (mirrors the intake rate-limit convention).

import { type NextRequest } from 'next/server'
import { RegisterSchema } from 'features/accounts/schemas/register.schema'
import { AccountService } from 'features/accounts/services/account.service'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`register:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
    }

    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await AccountService.register(parsed.data)

    return successResponse(result, 201)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

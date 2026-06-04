// POST /api/v1/admin/verification/:restaurantId/needs-info
//
// Transitions restaurant to NEEDS_INFO. feedbackToSubmitter is required.
// Generates a response token and sends it to the submitter by email.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      { feedbackToSubmitter: string }
// Errors:    422 (missing/short feedback, invalid transition), 404
// Governed by: track-02 §9.3, §5.4

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import { NeedsInfoActionSchema } from 'features/verification/schemas/transition.schema'
import { VerificationService } from 'features/verification'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response'

export async function POST(
  request: NextRequest,
  { params }: { params: { restaurantId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
    requireRole(session, [UserRole.ADMIN, UserRole.SUPER])

    const rl = await checkRateLimit(`admin:${session.user.id}`, 200, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    let body: unknown
    try { body = await request.json() } catch {
      return errorResponse('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
    }

    const parsed = NeedsInfoActionSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    await VerificationService.requestInfo({
      restaurantId:        params.restaurantId,
      actorId:             session.user.id,
      actorRole:           session.user.role as 'ADMIN' | 'SUPER',
      ipAddress:           extractIp(request),
      feedbackToSubmitter: parsed.data.feedbackToSubmitter,
    })

    return successResponse({ message: 'Information requested from submitter.' })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

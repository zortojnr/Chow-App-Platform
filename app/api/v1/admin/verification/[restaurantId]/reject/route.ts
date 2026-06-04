// POST /api/v1/admin/verification/:restaurantId/reject
//
// Transitions restaurant to REJECTED. reason is required (min 10 chars).
// Hard-zeros the confidence score and sends rejection notification.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      { reason: string }
// Errors:    422 (missing/short reason, invalid transition), 404
// Governed by: track-02 §9.3, §5.5

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import { RejectActionSchema } from 'features/verification/schemas/transition.schema'
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

    const parsed = RejectActionSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    await VerificationService.reject({
      restaurantId: params.restaurantId,
      actorId:      session.user.id,
      actorRole:    session.user.role as 'ADMIN' | 'SUPER',
      ipAddress:    extractIp(request),
      reason:       parsed.data.reason,
    })

    return successResponse({ message: 'Restaurant rejected.' })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

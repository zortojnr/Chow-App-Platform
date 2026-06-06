// POST /api/v1/admin/verification/:restaurantId/approve
//
// Transitions restaurant to APPROVED. Enforces the 0.40 confidence threshold,
// recalculates score, and sends approval notification to submitter.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      { notes?: string }
// Success:   200 { restaurantId, verificationStatus, confidenceScore }
// Errors:    422 (invalid transition, score below threshold), 404
// Governed by: track-02 §9.3, §5.3

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import { ApproveActionSchema } from 'features/verification/schemas/transition.schema'
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
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  const { restaurantId } = await params
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

    const parsed = ApproveActionSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await VerificationService.approve({
      restaurantId,
      actorId:      session.user.id,
      actorRole:    session.user.role as 'ADMIN' | 'SUPER',
      ipAddress:    extractIp(request),
      notes:        parsed.data.notes,
    })

    return successResponse({
      restaurantId:       result.restaurantId,
      verificationStatus: result.verificationStatus,
      confidenceScore:    result.confidenceScore,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

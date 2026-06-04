// POST /api/v1/admin/verification/:restaurantId/score/override
//
// SUPER-only manual confidence score override. Writes an OverrideBreakdown to
// VerificationRecord.scoreBreakdown. Requires a reason (min 10 chars).
// Role is checked at both the route and service layer (three-layer model).
//
// Auth:      session required (401)
// Role:      SUPER only (403 for ADMIN and below)
// Rate:      200 per session per minute
// Body:      { score: number (0–1), reason: string }
// Governed by: track-02 §9.4, security-standards.md §9.3, admin-platform-track.md §7.1

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { ScoreOverrideSchema } from 'features/verification/schemas/transition.schema'
import { IntelligenceService } from 'features/verification'
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
    requireRole(session, [UserRole.SUPER])

    const rl = await checkRateLimit(`admin:${session.user.id}`, 200, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    let body: unknown
    try { body = await request.json() } catch {
      return errorResponse('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
    }

    const parsed = ScoreOverrideSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    await IntelligenceService.overrideScore({
      restaurantId: params.restaurantId,
      actorId:      session.user.id,
      actorRole:    session.user.role,
      score:        parsed.data.score,
      reason:       parsed.data.reason,
    })

    return successResponse({ message: 'Score override applied.' })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

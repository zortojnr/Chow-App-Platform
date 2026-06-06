// POST /api/v1/admin/verification/:restaurantId/reopen
//
// Transitions REJECTED → PENDING_REVIEW. Returns the submission to the review queue.
// Used by the Re-open action on the admin review screen (Step 18).
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Governed by: track-02 §4.1 (state machine), verification-system-track §2.2

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import { VerificationService } from 'features/verification/services/verification.service'
import {
  successResponse,
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

    await VerificationService.reopen({
      restaurantId,
      actorId:      session.user.id,
      actorRole:    session.user.role as 'ADMIN' | 'SUPER',
      ipAddress:    extractIp(request),
    })

    return successResponse({ restaurantId })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

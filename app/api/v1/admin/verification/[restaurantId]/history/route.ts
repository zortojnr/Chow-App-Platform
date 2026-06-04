// GET /api/v1/admin/verification/:restaurantId/history
//
// Returns the complete append-only VerificationEvent audit log for a restaurant,
// ordered oldest-first. No pagination — restaurants accumulate at most a handful
// of events across their lifecycle.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Governed by: track-02 §9.3, §8.1

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { QueueService } from 'features/admin/services/queue.service'
import {
  successResponse,
  rateLimitResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response'

export async function GET(
  _request: NextRequest,
  { params }: { params: { restaurantId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
    requireRole(session, [UserRole.ADMIN, UserRole.SUPER])

    const rl = await checkRateLimit(`admin:${session.user.id}`, 200, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const events = await QueueService.getHistory(params.restaurantId)

    return successResponse({ events })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

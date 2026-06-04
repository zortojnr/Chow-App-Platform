// GET /api/v1/admin/verification/:restaurantId
//
// Returns full restaurant + verification detail for the admin review screen.
// READ ONLY — does not trigger soft assignment. Assignment is the responsibility
// of POST /assign, which the UI calls explicitly after opening the review screen.
//
// Rationale: GET must be idempotent (RFC 7231). A GET with a write side effect
// is broken by caching, browser prefetch, and monitoring tools.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Governed by: track-02 §9.3, admin-platform-track.md §3.3

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

    const restaurant = await QueueService.getDetail(params.restaurantId)

    return successResponse(restaurant)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

// GET /api/v1/admin/verification/queue
//
// Returns a paginated, filtered list of VerificationRecords for the admin queue.
// "me" in assignedTo is resolved to the requesting admin's session ID here,
// keeping the service free of request context.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Governed by: track-02 §9.3, admin-platform-track.md §4.1

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { QueueQuerySchema } from 'features/admin/schemas/queue.schema'
import { QueueService } from 'features/admin/services/queue.service'
import {
  paginatedSuccessResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
    requireRole(session, [UserRole.ADMIN, UserRole.SUPER])

    const rl = await checkRateLimit(`admin:${session.user.id}`, 200, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = QueueQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await QueueService.getQueue(parsed.data, session.user.id)

    return paginatedSuccessResponse(result.records, {
      total: result.total,
      page:  result.page,
      limit: result.limit,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

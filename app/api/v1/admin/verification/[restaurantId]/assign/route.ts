// POST /api/v1/admin/verification/:restaurantId/assign
//
// Soft-assigns (or un-assigns) an admin to a VerificationRecord.
// Advisory only — does not lock the record or create a VerificationEvent.
// Called by the UI immediately after opening the review screen to signal
// to other admins who is currently reviewing.
//
// adminId: null removes any existing assignment.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      { adminId: string (UUID) | null }
// Governed by: track-02 §5.1, admin-platform-track.md §3.2

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { AssignActionSchema } from 'features/verification/schemas/transition.schema'
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

    const parsed = AssignActionSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    // assignAdmin is non-throwing — failure is silently swallowed at service layer
    await VerificationService.assignAdmin({
      restaurantId,
      adminId:      parsed.data.adminId,
    })

    return successResponse({ assigned: parsed.data.adminId })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

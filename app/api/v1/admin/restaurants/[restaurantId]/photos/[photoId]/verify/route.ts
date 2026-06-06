// PATCH /api/v1/admin/restaurants/:restaurantId/photos/:photoId/verify
//
// Updates RestaurantPhoto.isVerified and optionally isPrimary.
// Score recalculation is triggered only when isVerified changes (PHOTO_VERIFIED).
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      { isVerified: boolean, isPrimary?: boolean }
// Governed by: track-02 §9.4, §6.1

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { VerifyPhotoSchema } from 'features/admin/schemas/intelligence.schema'
import { IntelligenceService } from 'features/verification'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; photoId: string }> },
) {
  const { photoId } = await params
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

    const parsed = VerifyPhotoSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await IntelligenceService.verifyPhoto({
      photoId:    photoId,
      adminId:    session.user.id,
      isVerified: parsed.data.isVerified,
      isPrimary:  parsed.data.isPrimary,
    })

    return successResponse({
      photoId:    result.photoId,
      isVerified: result.isVerified,
      isPrimary:  result.isPrimary,
      newScore:   result.newScore,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

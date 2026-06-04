// PATCH /api/v1/admin/restaurants/:restaurantId/dishes/:dishId/verify
//
// Marks a RestaurantDish as admin-verified. Sets verifiedAt and optionally
// updates nameAsServed, availabilityStatus, and price. Triggers score
// recalculation (FIELD_UPDATED trigger).
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      { verifiedAt?, nameAsServed?, availabilityStatus?, price? }
// Governed by: track-02 §9.4, §6.1

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { VerifyDishSchema } from 'features/admin/schemas/intelligence.schema'
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
  { params }: { params: { restaurantId: string; dishId: string } },
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

    const parsed = VerifyDishSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await IntelligenceService.verifyDish({
      restaurantDishId:   params.dishId,
      adminId:            session.user.id,
      verifiedAt:         parsed.data.verifiedAt ? new Date(parsed.data.verifiedAt) : undefined,
      nameAsServed:       parsed.data.nameAsServed,
    })

    return successResponse({
      restaurantDishId: result.restaurantDishId,
      verifiedAt:       result.verifiedAt,
      newScore:         result.newScore,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

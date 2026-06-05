// PATCH /api/v1/admin/restaurants/:restaurantId/dishes/:dishId/verify
//
// Dispatches to intelligence service operations based on which fields are
// present in the request body. All fields are optional; multiple can be
// sent in one request:
//
//   verifiedAt / nameAsServed   → IntelligenceService.verifyDish()      (score recalculates)
//   availabilityStatus          → IntelligenceService.updateAvailability() (no recalculation)
//   price                       → IntelligenceService.updatePricing()      (no recalculation)
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
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

    const { verifiedAt, nameAsServed, availabilityStatus, price } = parsed.data
    const result: Record<string, unknown> = {}

    // verifyDish: sets verifiedAt (last-confirmed timestamp) and optionally nameAsServed
    if (verifiedAt !== undefined || nameAsServed !== undefined) {
      const res = await IntelligenceService.verifyDish({
        restaurantDishId: params.dishId,
        adminId:          session.user.id,
        verifiedAt:       verifiedAt ? new Date(verifiedAt) : undefined,
        nameAsServed,
      })
      result.restaurantDishId = res.restaurantDishId
      result.verifiedAt       = res.verifiedAt
      result.newScore         = res.newScore
    }

    // updateAvailability: no score recalculation
    if (availabilityStatus !== undefined) {
      await IntelligenceService.updateAvailability({
        restaurantDishId:   params.dishId,
        adminId:            session.user.id,
        availabilityStatus,
      })
      result.availabilityStatus = availabilityStatus
    }

    // updatePricing: no score recalculation
    if (price !== undefined) {
      await IntelligenceService.updatePricing({
        restaurantDishId: params.dishId,
        adminId:          session.user.id,
        price,
      })
      result.price = price
    }

    return successResponse(result)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

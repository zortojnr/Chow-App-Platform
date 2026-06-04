// PATCH /api/v1/admin/restaurants/:restaurantId/intelligence
//
// Updates allowed restaurant fields and recalculates confidence score.
// Forbidden fields (name, slug, city, state, verificationStatus) are excluded
// by IntelligenceUpdateSchema — they cannot be sent in this request.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      partial { description?, phone?, email?, website?, priceRange?, area? }
// Governed by: track-02 §9.4, §11.1

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { IntelligenceUpdateSchema } from 'features/admin/schemas/intelligence.schema'
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
  { params }: { params: { restaurantId: string } },
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

    const parsed = IntelligenceUpdateSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await IntelligenceService.recalculateRestaurantIntelligence({
      restaurantId: params.restaurantId,
      adminId:      session.user.id,
      fields:       parsed.data,
    })

    return successResponse({ restaurantId: result.restaurantId, confidenceScore: result.newScore })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

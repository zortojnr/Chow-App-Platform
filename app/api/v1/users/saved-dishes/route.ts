// POST /api/v1/users/saved-dishes
// GET  /api/v1/users/saved-dishes
//
// Implements the SavedDish API contract Track 4 §7.4 already promised the
// frontend (SearchRestaurantCard's bookmark button and useSavedDish hook).
//
// Auth: any authenticated session (USER, ADMIN, SUPER) — session required, no
// role restriction beyond "is logged in".
//
// Governed by: track-05-user-accounts.md §5

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SavedDishService } from 'features/accounts/services/saved-dish.service'
import {
  successResponse,
  paginatedSuccessResponse,
  errorResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const SaveDishSchema = z.object({
  restaurantDishId: z.string().uuid('restaurantDishId must be a valid UUID'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
    }

    const parsed = SaveDishSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await SavedDishService.saveDish(session.user.id, parsed.data.restaurantDishId)

    return successResponse(result, 201)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)

    const { searchParams } = request.nextUrl

    // Lightweight variant — hydrates the Zustand savedDishIds store on session
    // start (track-05 §5.2, §7.5 of track-04). Avoids joining restaurant/dish
    // context when only the id set is needed.
    if (searchParams.get('idsOnly') === 'true') {
      const entries = await SavedDishService.listSavedDishIds(session.user.id)
      return successResponse({ entries })
    }

    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? '20') || 20))
    const city = searchParams.get('city') ?? undefined

    const result = await SavedDishService.listSavedDishes(session.user.id, { page, limit, city })

    return paginatedSuccessResponse(result.items, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

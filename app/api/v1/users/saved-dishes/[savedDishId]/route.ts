// DELETE /api/v1/users/saved-dishes/:savedDishId
//
// Track 4 §7.4 contract. Ownership enforced in SavedDishService.unsaveDish —
// throws ForbiddenError if the record does not belong to the caller.
//
// Governed by: track-05-user-accounts.md §5

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SavedDishService } from 'features/accounts/services/saved-dish.service'
import { errorResponse, serverErrorResponse } from '@/lib/api-response'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ savedDishId: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)

    const { savedDishId } = await params
    await SavedDishService.unsaveDish(session.user.id, savedDishId)

    return new Response(null, { status: 204 })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

// GET /api/v1/users/search-history
//
// Feeds the search bar's idle-state dropdown for authenticated users.
// UserSearchHistory is written by SearchLogService (track-04 §8.1); this
// route only reads it back.
//
// Governed by: track-05-user-accounts.md §7

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SearchHistoryService } from 'features/accounts/services/search-history.service'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)

    const items = await SearchHistoryService.listRecent(session.user.id)
    return successResponse({ items })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

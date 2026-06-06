// GET /api/v1/restaurants/:slug
//
// Returns a full consumer profile for an APPROVED restaurant.
// Delegates entirely to RestaurantListingService.getRestaurantProfile().
//
// Security contract (restaurant-listing-track.md §5.1):
//   - null return from service → 404. No distinction between "not found" and
//     "not approved" — prevents reconnaissance of the submission pipeline.
//   - Raw confidenceScore is never in the response (service maps to ScoreBand).
//   - Only isVerified photos are included (enforced by the service query).
//   - No admin-internal fields (verificationStatus, internalNotes, etc.).
//
// Auth:   none
// Rate:   120/IP/min
// Governed by: restaurant-listing-track.md §5.1, §7.2, §12.1
//              backend-standards.md §1, security-standards.md §6.1a

import { type NextRequest } from 'next/server'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  rateLimitResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response'

const RATE_LIMIT     = 120
const RATE_WINDOW_MS = 60 * 1000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  try {
    const ip = extractIp(request)

    const rl = await checkRateLimit(`restaurant-profile:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const restaurant = await RestaurantListingService.getRestaurantProfile(slug)
    if (!restaurant) return errorResponse('NOT_FOUND', 'Restaurant not found', 404)

    return successResponse(restaurant)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

// POST /api/v1/admin/restaurants/:restaurantId/geocode
//
// Triggers Google Maps geocoding for a restaurant's address, persisting
// latitude, longitude, geocodedAt, and geocodeConf to the record.
//
// Auth:      session required (401)
// Role:      ADMIN or SUPER (403)
// Rate:      200 per session per minute
// Body:      empty (address is taken from the existing restaurant record)
//
// Privacy: this endpoint sets RESTAURANT coordinates only.
// User GPS coordinates are never touched by this endpoint or service.
//
// Governed by: track-07-navigation-location.md §4

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions, requireRole } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { GeocodingService } from 'features/location/services/geocoding.service'
import {
  successResponse,
  rateLimitResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/api-response'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  const { restaurantId } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
    requireRole(session, [UserRole.ADMIN, UserRole.SUPER])

    const rl = await checkRateLimit(`admin:${session.user.id}`, 200, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const result = await GeocodingService.geocodeRestaurant(restaurantId)
    return successResponse(result)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

// DELETE — clears coordinates (used when restaurant address changes)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  const { restaurantId } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
    requireRole(session, [UserRole.ADMIN, UserRole.SUPER])

    await GeocodingService.clearCoordinates(restaurantId)
    return successResponse({ cleared: true })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

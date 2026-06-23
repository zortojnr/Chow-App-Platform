// GET /api/v1/dishes/discover
//
// Returns a deduped list of dishes available at approved restaurants
// in a given city/area — the dish-first "Near You" discovery feed.
//
// Query params:
//   city   required — e.g. "Abuja"
//   area   optional — e.g. "Wuse 2"
//   limit  optional — max results (default 8, max 20)
//   lat    optional — user latitude, Track 7 proximity sort
//   lng    optional — user longitude, Track 7 proximity sort
//
// Each result includes the best restaurant for that dish. Without GPS,
// "best" means highest confidence score. With GPS (lat+lng present),
// results are instead sorted by distance from the user.
// Deduplication: one entry per canonical dish name.
//
// Rate: 60/IP/min

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { haversineKm } from '@/lib/geo'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const Schema = z.object({
  city:  z.string().min(1).max(100),
  area:  z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  lat:   z.coerce.number().min(-90).max(90).optional(),
  lng:   z.coerce.number().min(-180).max(180).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)
    const rl = await checkRateLimit(`dishes-discover:${ip}`, 60, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = Schema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { city, area, limit, lat, lng } = parsed.data
    const hasGPS = lat !== undefined && lng !== undefined

    // Fetch more than needed so JS-side dedup can reach the limit
    const raw = await db.restaurantDish.findMany({
      where: {
        deletedAt: null,
        restaurant: {
          verificationStatus: 'APPROVED',
          deletedAt: null,
          city:  { equals: city, mode: 'insensitive' },
          ...(area ? { area: { equals: area, mode: 'insensitive' } } : {}),
        },
      },
      select: {
        dish: {
          select: { id: true, canonicalName: true, category: true },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            area: true,
            priceRange: true,
            thumbnailUrl: true,
            confidenceScore: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      // Best restaurants first so dedup keeps the highest-confidence entry per dish.
      // When GPS is present, re-sorted by distance below instead.
      orderBy: [{ restaurant: { confidenceScore: 'desc' } }, { createdAt: 'desc' }],
      take: limit * 5,
    })

    // One result per dish — first occurrence wins (highest confidence restaurant)
    const seen = new Set<string>()
    let dishes = raw
      .filter((item) => {
        if (seen.has(item.dish.id)) return false
        seen.add(item.dish.id)
        return true
      })
      .map((item) => ({
        dishId:         item.dish.id,
        canonicalName:  item.dish.canonicalName,
        category:       item.dish.category,
        restaurantId:   item.restaurant.id,
        restaurantName: item.restaurant.name,
        restaurantSlug: item.restaurant.slug,
        area:           item.restaurant.area,
        priceRange:     item.restaurant.priceRange,
        thumbnailUrl:   item.restaurant.thumbnailUrl,
        distanceKm: hasGPS && item.restaurant.latitude !== null && item.restaurant.longitude !== null
          ? haversineKm(lat!, lng!, item.restaurant.latitude, item.restaurant.longitude)
          : null,
      }))

    // GPS present: nearest first. Geocoded restaurants come before
    // un-geocoded ones (distanceKm null sorts last).
    if (hasGPS) {
      dishes = dishes.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0
        if (a.distanceKm === null) return 1
        if (b.distanceKm === null) return -1
        return a.distanceKm - b.distanceKm
      })
    }

    return successResponse(dishes.slice(0, limit))
  } catch (error) {
    return serverErrorResponse(error)
  }
}

// GET /api/v1/dishes/discover
//
// Returns a deduped list of dishes available at approved restaurants
// in a given city/area — the dish-first "Near You" discovery feed.
//
// Query params:
//   city   required — e.g. "Abuja"
//   area   optional — e.g. "Wuse 2"
//   limit  optional — max results (default 8, max 20)
//
// Each result includes the best restaurant for that dish (highest
// confidence score). Deduplication: one entry per canonical dish name.
//
// Rate: 60/IP/min

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
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
})

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)
    const rl = await checkRateLimit(`dishes-discover:${ip}`, 60, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = Schema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { city, area, limit } = parsed.data

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
          },
        },
      },
      // Best restaurants first so dedup keeps the highest-confidence entry per dish
      orderBy: [{ restaurant: { confidenceScore: 'desc' } }, { createdAt: 'desc' }],
      take: limit * 5,
    })

    // One result per dish — first occurrence wins (highest confidence restaurant)
    const seen = new Set<string>()
    const dishes = raw
      .filter((item) => {
        if (seen.has(item.dish.id)) return false
        seen.add(item.dish.id)
        return true
      })
      .slice(0, limit)
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
      }))

    return successResponse(dishes)
  } catch (error) {
    return serverErrorResponse(error)
  }
}

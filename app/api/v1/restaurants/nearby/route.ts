// GET /api/v1/restaurants/nearby
//
// Returns APPROVED restaurants sorted by distance from a given coordinate.
// Haversine distance is computed in SQL for server-side ordering and radius filter.
//
// Query params:
//   lat      required  — user latitude  (-90 to 90)
//   lng      required  — user longitude (-180 to 180)
//   radius   optional  — km cutoff (default 20, max 50)
//   limit    optional  — max results (default 10, max 20)
//
// Privacy: lat/lng are coordinate inputs for sorting only — never logged or stored.
//
// Rate: 60/IP/min
// Governed by: track-07-navigation-location.md §5

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { haversineKm, formatDistance } from '@/lib/geo'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractIp } from '@/lib/ip'
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '@/lib/api-response'

const NearbyQuerySchema = z.object({
  lat:    z.coerce.number().min(-90).max(90),
  lng:    z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(20),
  limit:  z.coerce.number().int().min(1).max(20).default(10),
})

type NearbyRow = {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  cuisineTypes: string[]
  thumbnailUrl: string | null
  priceRange: string
  latitude: number
  longitude: number
  distanceKm: number
}

export async function GET(request: NextRequest) {
  try {
    const ip = extractIp(request)
    const rl = await checkRateLimit(`nearby:${ip}`, 60, 60_000)
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

    const { searchParams } = new URL(request.url)
    const parsed = NearbyQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const { lat, lng, radius, limit } = parsed.data

    // Haversine in SQL — only restaurants with coordinates are candidates
    const rows = await db.$queryRaw<NearbyRow[]>(Prisma.sql`
      SELECT
        r.id,
        r.name,
        r.slug,
        r.city,
        r.area,
        r."cuisineTypes",
        r."thumbnailUrl",
        r."priceRange",
        r.latitude,
        r.longitude,
        (
          2 * 6371 * ASIN(SQRT(
            POWER(SIN((RADIANS(r.latitude) - RADIANS(${lat})) / 2), 2) +
            COS(RADIANS(${lat})) * COS(RADIANS(r.latitude)) *
            POWER(SIN((RADIANS(r.longitude) - RADIANS(${lng})) / 2), 2)
          ))
        ) AS "distanceKm"
      FROM "Restaurant" r
      WHERE r."verificationStatus" = 'APPROVED'
        AND r."deletedAt" IS NULL
        AND r.latitude  IS NOT NULL
        AND r.longitude IS NOT NULL
        AND (
          2 * 6371 * ASIN(SQRT(
            POWER(SIN((RADIANS(r.latitude) - RADIANS(${lat})) / 2), 2) +
            COS(RADIANS(${lat})) * COS(RADIANS(r.latitude)) *
            POWER(SIN((RADIANS(r.longitude) - RADIANS(${lng})) / 2), 2)
          ))
        ) <= ${radius}
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}
    `)

    const results = rows.map((r) => ({
      id:                r.id,
      name:              r.name,
      slug:              r.slug,
      city:              r.city,
      area:              r.area,
      cuisineTypes:      r.cuisineTypes,
      thumbnailUrl:      r.thumbnailUrl,
      priceRange:        r.priceRange,
      distanceKm:        Number(r.distanceKm),
      formattedDistance: formatDistance(Number(r.distanceKm)),
    }))

    return successResponse({ restaurants: results, total: results.length })
  } catch (error) {
    return serverErrorResponse(error)
  }
}

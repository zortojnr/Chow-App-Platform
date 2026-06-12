// Zod schema for GET /api/v1/restaurants query parameters.
//
// All parameters arrive as query strings; z.coerce.number() handles
// the page/limit conversion. PriceRange is validated against the
// Prisma enum to prevent arbitrary strings reaching the service.
//
// Governed by: restaurant-listing-track.md §12.4, backend-standards.md §3.4

import { z } from 'zod'
import { PriceRange } from '@prisma/client'

export const RestaurantIndexQuerySchema = z.object({
  city:      z.string().trim().min(1).max(100).optional(),
  area:      z.string().trim().min(1).max(100).optional(),
  priceRange: z.nativeEnum(PriceRange).optional(),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(12),
})

export type RestaurantIndexQueryInput = z.infer<typeof RestaurantIndexQuerySchema>

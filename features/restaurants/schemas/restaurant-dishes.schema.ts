// Zod schema for GET /api/v1/restaurants/:slug/dishes query parameters.
//
// DishCategory is validated against the Prisma enum to prevent arbitrary
// strings reaching the service. page/limit are coerced from query strings.
//
// Governed by: restaurant-listing-track.md §12.3, backend-standards.md §3.4

import { z } from 'zod'
import { DishCategory } from '@prisma/client'

export const RestaurantDishesQuerySchema = z.object({
  category: z.nativeEnum(DishCategory).optional(),

  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(20),
})

export type RestaurantDishesQueryInput = z.infer<typeof RestaurantDishesQuerySchema>

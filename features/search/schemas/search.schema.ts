// Zod validation schemas for all Track 4 search and discovery query params.
//
// Rules:
//   - All query-string numbers arrive as strings — use z.coerce.number()
//   - Unknown enum values → 422 VALIDATION_ERROR (not silent coercion)
//   - Trim all strings before validation
//   - Do not set defaults in route handlers — defaults live here
//
// Governed by: track-04-search-discovery.md §14, backend-standards.md §3.4

import { z } from 'zod'
import { DishCategory } from '@prisma/client'

// ─── GET /api/v1/search ───────────────────────────────────────

export const SearchQuerySchema = z.object({
  q:    z.string().trim().min(1, 'Query is required').max(200),
  type: z.enum(['dishes', 'restaurants', 'all']).default('all'),
  city: z.string().trim().min(1).max(100).optional(),
  area: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
})
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>

// ─── GET /api/v1/search/dishes ────────────────────────────────

export const DishSearchQuerySchema = z.object({
  q:        z.string().trim().min(1, 'Query is required').max(200),
  category: z.nativeEnum(DishCategory).optional(),
  limit:    z.coerce.number().int().min(1).max(20).default(8),
})
export type DishSearchQueryInput = z.infer<typeof DishSearchQuerySchema>

// ─── GET /api/v1/search/dishes/[dishId]/restaurants ──────────

export const DishRestaurantsQuerySchema = z.object({
  q:    z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  area: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
})
export type DishRestaurantsQueryInput = z.infer<typeof DishRestaurantsQuerySchema>

// ─── GET /api/v1/search/suggestions ─────────────────────────

export const SuggestionsQuerySchema = z.object({
  q: z.string().trim().min(2, 'Minimum 2 characters required').max(100),
})
export type SuggestionsQueryInput = z.infer<typeof SuggestionsQuerySchema>

// ─── GET /api/v1/discovery/popular-dishes ────────────────────

export const PopularDishesQuerySchema = z.object({
  location: z.string().trim().min(1).max(100).optional(),
  limit:    z.coerce.number().int().min(1).max(20).default(8),
  window:   z.enum(['7d', '30d']).default('30d'),
})
export type PopularDishesQueryInput = z.infer<typeof PopularDishesQuerySchema>

// ─── GET /api/v1/discovery/trending-dishes ───────────────────

export const TrendingDishesQuerySchema = z.object({
  location: z.string().trim().min(1).max(100).optional(),
  limit:    z.coerce.number().int().min(1).max(20).default(8),
  // Comma-separated dishIds to exclude (deduplication vs popular-dishes)
  exclude:  z.string().trim().optional(),
})
export type TrendingDishesQueryInput = z.infer<typeof TrendingDishesQuerySchema>

// ─── GET /api/v1/discovery/just-verified-dishes ──────────────

export const JustVerifiedQuerySchema = z.object({
  location: z.string().trim().min(1).max(100).optional(),
  limit:    z.coerce.number().int().min(1).max(8).default(6),
})
export type JustVerifiedQueryInput = z.infer<typeof JustVerifiedQuerySchema>

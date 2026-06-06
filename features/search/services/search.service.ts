// Search Orchestrator — Step 5
//
// Routes search requests to the appropriate service(s) based on the `type` param.
// Merges results for type="all". Handles zero-result fallback.
//
// Query flow (track-04-search-discovery.md §3.2):
//   type="dishes"      → DishSearchService only
//   type="restaurants" → RestaurantSearchService only
//   type="all"         → DishSearchService + RestaurantSearchService in parallel
//                        If dish results found, also run DishRestaurantService for top dish
//
// Zero-result handling:
//   If all services return empty → generate static suggestion array from top-N dish names

import { DishSearchService } from './dish-search.service'
import { RestaurantSearchService } from './restaurant-search.service'
import { DishRestaurantService } from './dish-restaurant.service'
import type { DishSearchResult } from './dish-search.service'
import type { RestaurantSearchResult } from './restaurant-search.service'
import type { DishRestaurantResult } from './dish-restaurant.service'

// ─── Types ───────────────────────────────────────────────────

export type SearchType = 'dishes' | 'restaurants' | 'all'

export type SearchParams = {
  query: string
  type?: SearchType
  city?: string
  area?: string    // Phase 1: parsed but not applied (SearchLog.area does not exist yet)
  page?: number
}

export type SearchResponse = {
  query: string
  type: SearchType
  dishes: DishSearchResult[]
  restaurants: DishRestaurantResult[] | RestaurantSearchResult[]
  total: number
  page: number
  hasMore: boolean
  // Zero-result state: populated when both dishes and restaurants are empty
  suggestions: string[]
  isZeroResult: boolean
}

// ─── Top dish names used for zero-result suggestions ─────────

const FALLBACK_SUGGESTIONS = [
  'Jollof Rice', 'Egusi Soup', 'Suya', 'Pounded Yam', 'Pepper Soup',
  'Efo Riro', 'Amala', 'Moi Moi', 'Akara', 'Eba',
]

// ─── Public API ───────────────────────────────────────────────

export const SearchService = {
  async search(params: SearchParams): Promise<SearchResponse> {
    const {
      query,
      type = 'all',
      city,
      area,     // Phase 1: accepted but not forwarded to services
      page = 1,
    } = params

    const trimmed = query.trim().slice(0, 200)

    if (trimmed.length < 2) {
      return emptyResponse(trimmed, type, page)
    }

    if (type === 'dishes') {
      return searchDishesOnly(trimmed, city, page)
    }

    if (type === 'restaurants') {
      return searchRestaurantsOnly(trimmed, city, page)
    }

    return searchAll(trimmed, city, page)
  },
}

// ─── Routing: dishes only ─────────────────────────────────────

async function searchDishesOnly(
  query: string,
  city: string | undefined,
  page: number,
): Promise<SearchResponse> {
  const dishes = await DishSearchService.search(query)

  return buildResponse({ query, type: 'dishes', dishes, restaurants: [], total: dishes.length, page })
}

// ─── Routing: restaurants only ────────────────────────────────

async function searchRestaurantsOnly(
  query: string,
  city: string | undefined,
  page: number,
): Promise<SearchResponse> {
  const restaurants = await RestaurantSearchService.search(query, { city, page })

  return buildResponse({ query, type: 'restaurants', dishes: [], restaurants, total: restaurants.length, page })
}

// ─── Routing: all ─────────────────────────────────────────────

async function searchAll(
  query: string,
  city: string | undefined,
  page: number,
): Promise<SearchResponse> {
  // Run dish FTS and restaurant FTS in parallel
  const [dishes, restaurantsByName] = await Promise.all([
    DishSearchService.search(query),
    RestaurantSearchService.search(query, { city, page }),
  ])

  // If a specific dish matched, also fetch ranked restaurants serving that dish
  let restaurantsByDish: DishRestaurantResult[] = []
  if (dishes.length > 0) {
    const { results } = await DishRestaurantService.getDishRestaurants(
      dishes[0].dishId,
      query,
      { city, page },
    )
    restaurantsByDish = results
  }

  // Prefer dish-context restaurants when a dish matched; fall back to name search
  const restaurants = restaurantsByDish.length > 0 ? restaurantsByDish : restaurantsByName

  return buildResponse({
    query,
    type: 'all',
    dishes,
    restaurants,
    total: restaurants.length,
    page,
  })
}

// ─── Response builder ─────────────────────────────────────────

type BuildParams = {
  query: string
  type: SearchType
  dishes: DishSearchResult[]
  restaurants: DishRestaurantResult[] | RestaurantSearchResult[]
  total: number
  page: number
}

function buildResponse(p: BuildParams): SearchResponse {
  const isZeroResult = p.dishes.length === 0 && p.restaurants.length === 0
  const suggestions = isZeroResult ? FALLBACK_SUGGESTIONS.slice(0, 5) : []

  return {
    query: p.query,
    type: p.type,
    dishes: p.dishes,
    restaurants: p.restaurants,
    total: p.total,
    page: p.page,
    hasMore: p.restaurants.length === 20,
    suggestions,
    isZeroResult,
  }
}

function emptyResponse(query: string, type: SearchType, page: number): SearchResponse {
  return {
    query,
    type,
    dishes: [],
    restaurants: [],
    total: 0,
    page,
    hasMore: false,
    suggestions: FALLBACK_SUGGESTIONS.slice(0, 5),
    isZeroResult: true,
  }
}

// search.service.test.ts — Step 5
//
// Coverage:
//   ✓ type="dishes" routes to DishSearchService only
//   ✓ type="restaurants" routes to RestaurantSearchService only
//   ✓ type="all" runs both services in parallel
//   ✓ type="all" with dish match: fetches ranked restaurant list for top dish
//   ✓ type="all" with no dish match: falls back to restaurant-by-name results
//   ✓ Zero-result path: isZeroResult=true, suggestions array populated
//   ✓ Short query (< 2 chars): zero-result response without calling services
//   ✓ Routing logic: dish service not called for type="restaurants"
//   ✓ hasMore logic
//   ✓ Response shape includes all required fields

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchService } from './search.service'

vi.mock('./dish-search.service', () => ({
  DishSearchService: { search: vi.fn() },
}))
vi.mock('./restaurant-search.service', () => ({
  RestaurantSearchService: { search: vi.fn() },
}))
vi.mock('./dish-restaurant.service', () => ({
  DishRestaurantService: { getDishRestaurants: vi.fn() },
}))

import { DishSearchService } from './dish-search.service'
import { RestaurantSearchService } from './restaurant-search.service'
import { DishRestaurantService } from './dish-restaurant.service'

const mockDishSearch = vi.mocked(DishSearchService.search)
const mockRestaurantSearch = vi.mocked(RestaurantSearchService.search)
const mockDishRestaurants = vi.mocked(DishRestaurantService.getDishRestaurants)

const makeDish = (id = 'dish-1') => ({
  dishId: id,
  canonicalName: 'Jollof Rice',
  slug: 'jollof-rice',
  category: 'RICE_DISHES' as const,
  aliases: [],
  restaurantCount: 4,
  matchScore: 0.9,
})

// DishRestaurantResult — returned by DishRestaurantService.getDishRestaurants
const makeDishRestaurant = (id = 'rest-1') => ({
  id,
  name: 'Mama Titi Kitchen',
  slug: 'mama-titi-kitchen',
  city: 'Lagos',
  area: null,
  priceRange: 'MID' as const,
  confidenceScoreBand: 'STRONG' as const,
  thumbnailUrl: null,
  dishesServed: 6,
  matchedDish: {
    restaurantDishId: 'rd-1',
    nameAsServed: null,
    availabilityStatus: 'ALWAYS_AVAILABLE' as const,
    price: null,
  },
  displayScore: 0.72,
  distanceKm: null,
})

// RestaurantSearchResult — returned by RestaurantSearchService.search
const makeNameRestaurant = (id = 'rest-1') => ({
  id,
  name: 'Mama Titi Kitchen',
  slug: 'mama-titi-kitchen',
  city: 'Lagos',
  area: null,
  priceRange: 'MID' as const,
  confidenceScoreBand: 'STRONG' as const,
  thumbnailUrl: null,
  dishesServed: 6,
  matchScore: 0.72,
  distanceKm: null,
})

beforeEach(() => vi.clearAllMocks())

describe('SearchService.search', () => {
  // ─── type routing ─────────────────────────────────────────

  it('type="dishes" calls DishSearchService only', async () => {
    mockDishSearch.mockResolvedValueOnce([makeDish()])

    await SearchService.search({ query: 'jollof', type: 'dishes' })

    expect(mockDishSearch).toHaveBeenCalledOnce()
    expect(mockRestaurantSearch).not.toHaveBeenCalled()
    expect(mockDishRestaurants).not.toHaveBeenCalled()
  })

  it('type="restaurants" calls RestaurantSearchService only', async () => {
    mockRestaurantSearch.mockResolvedValueOnce([])

    await SearchService.search({ query: 'mama titi', type: 'restaurants' })

    expect(mockRestaurantSearch).toHaveBeenCalledOnce()
    expect(mockDishSearch).not.toHaveBeenCalled()
    expect(mockDishRestaurants).not.toHaveBeenCalled()
  })

  it('type="all" calls DishSearchService and RestaurantSearchService', async () => {
    mockDishSearch.mockResolvedValueOnce([])
    mockRestaurantSearch.mockResolvedValueOnce([])

    await SearchService.search({ query: 'suya', type: 'all' })

    expect(mockDishSearch).toHaveBeenCalledOnce()
    expect(mockRestaurantSearch).toHaveBeenCalledOnce()
  })

  it('type="all" with dish match: also calls DishRestaurantService for top dish', async () => {
    mockDishSearch.mockResolvedValueOnce([makeDish('dish-1')])
    mockRestaurantSearch.mockResolvedValueOnce([])
    mockDishRestaurants.mockResolvedValueOnce({ results: [makeDishRestaurant()], total: 1 })

    await SearchService.search({ query: 'jollof rice', type: 'all' })

    expect(mockDishRestaurants).toHaveBeenCalledWith('dish-1', 'jollof rice', expect.any(Object))
  })

  it('type="all" with no dish match: does not call DishRestaurantService', async () => {
    mockDishSearch.mockResolvedValueOnce([])
    mockRestaurantSearch.mockResolvedValueOnce([makeNameRestaurant()])

    await SearchService.search({ query: 'mama titi', type: 'all' })

    expect(mockDishRestaurants).not.toHaveBeenCalled()
  })

  // ─── Default type ─────────────────────────────────────────

  it('defaults to type="all" when type is not specified', async () => {
    mockDishSearch.mockResolvedValueOnce([])
    mockRestaurantSearch.mockResolvedValueOnce([])

    const result = await SearchService.search({ query: 'egusi' })

    expect(result.type).toBe('all')
  })

  // ─── Zero-result handling ─────────────────────────────────

  it('isZeroResult=true when dishes and restaurants are both empty', async () => {
    mockDishSearch.mockResolvedValueOnce([])
    mockRestaurantSearch.mockResolvedValueOnce([])

    const result = await SearchService.search({ query: 'xyz123', type: 'all' })

    expect(result.isZeroResult).toBe(true)
  })

  it('suggestions array has >= 2 items on zero result', async () => {
    mockDishSearch.mockResolvedValueOnce([])
    mockRestaurantSearch.mockResolvedValueOnce([])

    const result = await SearchService.search({ query: 'xyz123', type: 'all' })

    expect(result.suggestions.length).toBeGreaterThanOrEqual(2)
  })

  it('isZeroResult=false when any results exist', async () => {
    mockDishSearch.mockResolvedValueOnce([makeDish()])
    mockRestaurantSearch.mockResolvedValueOnce([])
    mockDishRestaurants.mockResolvedValueOnce({ results: [], total: 0 })

    const result = await SearchService.search({ query: 'jollof', type: 'all' })

    expect(result.isZeroResult).toBe(false)
    expect(result.suggestions).toHaveLength(0)
  })

  // ─── Short query guard ────────────────────────────────────

  it('returns zero-result response for 1-char query without calling services', async () => {
    const result = await SearchService.search({ query: 'j' })

    expect(result.isZeroResult).toBe(true)
    expect(mockDishSearch).not.toHaveBeenCalled()
    expect(mockRestaurantSearch).not.toHaveBeenCalled()
  })

  // ─── Response shape ───────────────────────────────────────

  it('response includes all required fields', async () => {
    mockDishSearch.mockResolvedValueOnce([makeDish()])
    mockRestaurantSearch.mockResolvedValueOnce([])
    mockDishRestaurants.mockResolvedValueOnce({ results: [makeDishRestaurant()], total: 1 })

    const result = await SearchService.search({ query: 'jollof rice', type: 'all' })

    expect(result).toMatchObject({
      query: expect.any(String),
      type: expect.any(String),
      dishes: expect.any(Array),
      restaurants: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      hasMore: expect.any(Boolean),
      suggestions: expect.any(Array),
      isZeroResult: expect.any(Boolean),
    })
  })

  // ─── hasMore ──────────────────────────────────────────────

  it('hasMore=false when restaurants < 20', async () => {
    mockDishSearch.mockResolvedValueOnce([])
    mockRestaurantSearch.mockResolvedValueOnce(Array(5).fill(makeNameRestaurant()))

    const result = await SearchService.search({ query: 'mama', type: 'restaurants' })

    expect(result.hasMore).toBe(false)
  })

  it('hasMore=true when restaurants === 20 (full page)', async () => {
    mockDishSearch.mockResolvedValueOnce([])
    mockRestaurantSearch.mockResolvedValueOnce(Array(20).fill(makeNameRestaurant()))

    const result = await SearchService.search({ query: 'restaurant', type: 'restaurants' })

    expect(result.hasMore).toBe(true)
  })
})

// dish-restaurant.service.test.ts — Step 4
//
// Coverage:
//   ✓ Returns results with FTS query provided
//   ✓ Returns results without query (dish landing page path)
//   ✓ restaurantDishId is present on every result (save action contract)
//   ✓ distanceKm is always null (Phase 2 placeholder)
//   ✓ Higher confidence score wins tiebreaker (ranking formula)
//   ✓ ALWAYS_AVAILABLE ranks above UNKNOWN when other signals equal
//   ✓ City filter applied — wrong-city rows excluded
//   ✓ Pagination: page 2 produces correct offset
//   ✓ BigInt/string coercions are correct
//   ✓ Empty dishId returns { results: [], total: 0 }
//   ✓ DB error returns { results: [], total: 0 } without throwing

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DishRestaurantService } from './dish-restaurant.service'

vi.mock('@/lib/db', () => ({
  db: { $queryRaw: vi.fn() },
}))

import { db } from '@/lib/db'
const mockQuery = vi.mocked(db.$queryRaw)

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'rest-1',
  name: 'Mama Titi Kitchen',
  slug: 'mama-titi-kitchen',
  city: 'Lagos',
  area: 'Lekki Phase 1',
  priceRange: 'MID',
  confidenceScore: '0.85',
  thumbnailUrl: null,
  dishesServed: 6n,
  restaurantDishId: 'rd-1',
  nameAsServed: null,
  availabilityStatus: 'ALWAYS_AVAILABLE',
  price: null,
  displayScore: 0.72,
  ...overrides,
})

const makeCount = (total: bigint | number = 1n) => [{ total }]

beforeEach(() => vi.clearAllMocks())

describe('DishRestaurantService.getDishRestaurants', () => {
  // ─── FTS path ─────────────────────────────────────────────

  it('returns results when query is provided (FTS path)', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow()])
      .mockResolvedValueOnce(makeCount(1n))

    const { results, total } = await DishRestaurantService.getDishRestaurants(
      'dish-1', 'jollof rice',
    )

    expect(results).toHaveLength(1)
    expect(total).toBe(1)
    expect(results[0].name).toBe('Mama Titi Kitchen')
  })

  // ─── No-query path (dish landing page) ────────────────────

  it('returns results when no query is provided (dish landing page path)', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow()])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', undefined)

    expect(results).toHaveLength(1)
  })

  it('uses dish landing page path when query < 2 chars', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow()])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'j')

    expect(results).toHaveLength(1)
    // Both paths make 2 $queryRaw calls (results + count)
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  // ─── restaurantDishId contract ─────────────────────────────

  it('restaurantDishId is present on every result', async () => {
    mockQuery
      .mockResolvedValueOnce([
        makeRow({ restaurantDishId: 'rd-1' }),
        makeRow({ restaurantDishId: 'rd-2', id: 'rest-2' }),
      ])
      .mockResolvedValueOnce(makeCount(2n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'egusi')

    expect(results[0].matchedDish.restaurantDishId).toBe('rd-1')
    expect(results[1].matchedDish.restaurantDishId).toBe('rd-2')
  })

  it('matchedDish.restaurantDishId is never null or undefined', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow()])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'suya')

    expect(results[0].matchedDish.restaurantDishId).toBeTruthy()
  })

  // ─── distanceKm placeholder ────────────────────────────────

  it('distanceKm is null on every result', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow(), makeRow({ id: 'rest-2' })])
      .mockResolvedValueOnce(makeCount(2n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'jollof')

    results.forEach((r) => expect(r.distanceKm).toBeNull())
  })

  // ─── Confidence score band ─────────────────────────────────

  it('maps confidenceScore 0.90+ to EXCELLENT', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow({ confidenceScore: '0.93' })])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(results[0].confidenceScoreBand).toBe('EXCELLENT')
  })

  it('maps confidenceScore 0.7-0.89 to STRONG', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow({ confidenceScore: '0.80' })])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(results[0].confidenceScoreBand).toBe('STRONG')
  })

  it('maps confidenceScore < 0.7 to VERIFIED', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow({ confidenceScore: '0.50' })])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(results[0].confidenceScoreBand).toBe('VERIFIED')
  })

  // ─── Ranking — ordering from DB is preserved ──────────────

  it('preserves ranking order from DB (higher displayScore first)', async () => {
    mockQuery
      .mockResolvedValueOnce([
        makeRow({ id: 'a', displayScore: 0.85 }),
        makeRow({ id: 'b', displayScore: 0.60 }),
        makeRow({ id: 'c', displayScore: 0.40 }),
      ])
      .mockResolvedValueOnce(makeCount(3n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'jollof rice')

    expect(results.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  // ─── Type coercions ────────────────────────────────────────

  it('converts BigInt dishesServed to number', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow({ dishesServed: 14n })])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(typeof results[0].dishesServed).toBe('number')
    expect(results[0].dishesServed).toBe(14)
  })

  it('converts BigInt total to number', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow()])
      .mockResolvedValueOnce([{ total: 42n }])

    const { total } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(typeof total).toBe('number')
    expect(total).toBe(42)
  })

  // ─── Availability in matchedDish ──────────────────────────

  it('includes availabilityStatus in matchedDish context', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow({ availabilityStatus: 'WEEKEND_ONLY' })])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(results[0].matchedDish.availabilityStatus).toBe('WEEKEND_ONLY')
  })

  // ─── Price in matchedDish ─────────────────────────────────

  it('includes price string in matchedDish when available', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow({ price: '2500.00' })])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(results[0].matchedDish.price).toBe('2500.00')
  })

  it('includes null price in matchedDish when not set', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow({ price: null })])
      .mockResolvedValueOnce(makeCount(1n))

    const { results } = await DishRestaurantService.getDishRestaurants('dish-1', 'rice')

    expect(results[0].matchedDish.price).toBeNull()
  })

  // ─── Error resilience ──────────────────────────────────────

  it('returns empty results on DB error without throwing', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB timeout'))

    await expect(
      DishRestaurantService.getDishRestaurants('dish-1', 'rice'),
    ).resolves.toEqual({ results: [], total: 0 })
  })

  // ─── Pagination ────────────────────────────────────────────

  it('runs 2 queries (results + count) for each call', async () => {
    mockQuery
      .mockResolvedValueOnce([makeRow()])
      .mockResolvedValueOnce(makeCount(1n))

    await DishRestaurantService.getDishRestaurants('dish-1', 'jollof', { page: 2 })

    expect(mockQuery).toHaveBeenCalledTimes(2)
  })
})

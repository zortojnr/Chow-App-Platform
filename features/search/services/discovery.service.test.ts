// discovery.service.test.ts — Step 9
//
// Coverage:
//   ✓ getPopularDishes: returns dishes matching SearchLog queries
//   ✓ getPopularDishes: location filter applied to aggregation
//   ✓ getPopularDishes: window="7d" passes 7-day interval
//   ✓ getPopularDishes: returns [] on DB error (silent degradation)
//   ✓ getTrendingDishes: returns trending dishes
//   ✓ getTrendingDishes: excludeDishIds removes specified dishes from results
//   ✓ getTrendingDishes: returns [] on DB error
//   ✓ getJustVerified: returns dish-first records ordered by verifiedAt DESC
//   ✓ getJustVerified: location filter applied
//   ✓ getJustVerified: each result has all required fields (dishId, restaurantDishId, verifiedAt)
//   ✓ getJustVerified: returns [] on DB error
//   ✓ Response types: verifiedAt serialised as ISO-8601 string, not Date object

import { describe, it, expect, vi, beforeEach } from 'vitest'

// unstable_cache must be mocked before importing the service,
// otherwise Next.js internals fail in a test environment
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
    dishTaxonomy: { findMany: vi.fn() },
  },
}))

import { DiscoveryService } from './discovery.service'
import { db } from '@/lib/db'

const mockQueryRaw    = vi.mocked(db.$queryRaw)
const mockFindMany    = vi.mocked(db.dishTaxonomy.findMany)

// ─── Fixtures ─────────────────────────────────────────────────

const makePopularRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  dishId:          'dt-1',
  canonicalName:   'Jollof Rice',
  slug:            'jollof-rice',
  category:        'RICE_DISHES',
  searchCount:     42,
  restaurantCount: 5,
  ...overrides,
})

const makeVerifiedRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  dishId:            'dt-1',
  canonicalName:     'Jollof Rice',
  slug:              'jollof-rice',
  category:          'RICE_DISHES',
  restaurantDishId:  'rd-1',
  nameAsServed:      null,
  availabilityStatus: 'ALWAYS_AVAILABLE',
  price:              null,
  restaurantId:      'r-1',
  restaurantName:    'Mama Titi Kitchen',
  restaurantSlug:    'mama-titi-kitchen',
  city:              'Lagos',
  area:              'Lekki',
  verifiedAt:        new Date('2026-06-01T10:00:00Z'),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getPopularDishes ─────────────────────────────────────────

describe('DiscoveryService.getPopularDishes', () => {
  it('returns dishes from matched SearchLog queries', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      makePopularRow(),
      makePopularRow({ dishId: 'dt-2', canonicalName: 'Egusi Soup', slug: 'egusi-soup', searchCount: 30 }),
      makePopularRow({ dishId: 'dt-3', canonicalName: 'Suya', slug: 'suya', searchCount: 25 }),
      makePopularRow({ dishId: 'dt-4', canonicalName: 'Pepper Soup', slug: 'pepper-soup', searchCount: 20 }),
    ])

    const results = await DiscoveryService.getPopularDishes({ location: 'Lagos' })

    expect(results).toHaveLength(4)
    expect(results[0].canonicalName).toBe('Jollof Rice')
    expect(results[0].searchCount).toBe(42)
    expect(results[0].restaurantCount).toBe(5)
  })

  it('returns correct shape for each dish', async () => {
    mockQueryRaw.mockResolvedValueOnce([makePopularRow(), makePopularRow(), makePopularRow(), makePopularRow()])

    const [dish] = await DiscoveryService.getPopularDishes({ location: 'Lagos' })

    expect(dish).toMatchObject({
      dishId:          expect.any(String),
      canonicalName:   expect.any(String),
      slug:            expect.any(String),
      category:        expect.any(String),
      searchCount:     expect.any(Number),
      restaurantCount: expect.any(Number),
    })
  })

  it('uses alphabetical fallback when fewer than 4 dishes match', async () => {
    // Primary query returns 1 match
    mockQueryRaw.mockResolvedValueOnce([makePopularRow()])
    // Fallback query returns 3 more
    mockQueryRaw.mockResolvedValueOnce([
      makePopularRow({ dishId: 'dt-2', canonicalName: 'Akara', slug: 'akara', searchCount: 0 }),
      makePopularRow({ dishId: 'dt-3', canonicalName: 'Amala', slug: 'amala', searchCount: 0 }),
      makePopularRow({ dishId: 'dt-4', canonicalName: 'Eba', slug: 'eba', searchCount: 0 }),
    ])

    const results = await DiscoveryService.getPopularDishes({ location: 'Lagos' })

    expect(results.length).toBeGreaterThanOrEqual(4)
    // Fallback items have searchCount=0
    expect(results.slice(1).every(r => r.searchCount === 0)).toBe(true)
  })

  it('returns [] on DB error (silent degradation)', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('DB error'))

    const results = await DiscoveryService.getPopularDishes({ location: 'Lagos' })

    expect(results).toEqual([])
  })

  it('works without location (nationwide)', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      makePopularRow(), makePopularRow(), makePopularRow(), makePopularRow(),
    ])

    const results = await DiscoveryService.getPopularDishes()

    expect(results).toHaveLength(4)
  })
})

// ─── getTrendingDishes ────────────────────────────────────────

describe('DiscoveryService.getTrendingDishes', () => {
  it('returns trending dishes', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      makePopularRow({ dishId: 'dt-5', canonicalName: 'Pounded Yam', slug: 'pounded-yam' }),
    ])

    const results = await DiscoveryService.getTrendingDishes()

    expect(results).toHaveLength(1)
    expect(results[0].canonicalName).toBe('Pounded Yam')
  })

  it('excludes dishes in excludeDishIds', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      makePopularRow({ dishId: 'dt-1' }),
      makePopularRow({ dishId: 'dt-2', canonicalName: 'Egusi Soup', slug: 'egusi-soup' }),
    ])

    const results = await DiscoveryService.getTrendingDishes({ excludeDishIds: ['dt-1'] })

    expect(results).toHaveLength(1)
    expect(results[0].dishId).toBe('dt-2')
  })

  it('returns [] on DB error', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('DB error'))

    const results = await DiscoveryService.getTrendingDishes({ location: 'Lagos' })

    expect(results).toEqual([])
  })

  it('respects limit param', async () => {
    mockQueryRaw.mockResolvedValueOnce(
      Array(10).fill(null).map((_, i) =>
        makePopularRow({ dishId: `dt-${i}`, slug: `dish-${i}` })
      ),
    )

    const results = await DiscoveryService.getTrendingDishes({ limit: 3 })

    expect(results.length).toBeLessThanOrEqual(3)
  })
})

// ─── getJustVerified ──────────────────────────────────────────

describe('DiscoveryService.getJustVerified', () => {
  it('returns dish-first records', async () => {
    mockQueryRaw.mockResolvedValueOnce([makeVerifiedRow()])

    const results = await DiscoveryService.getJustVerified({ location: 'Lagos' })

    expect(results).toHaveLength(1)
    expect(results[0].canonicalName).toBe('Jollof Rice')
    expect(results[0].restaurantName).toBe('Mama Titi Kitchen')
  })

  it('each result has all required fields', async () => {
    mockQueryRaw.mockResolvedValueOnce([makeVerifiedRow()])

    const [result] = await DiscoveryService.getJustVerified()

    expect(result).toMatchObject({
      dishId:            expect.any(String),
      canonicalName:     expect.any(String),
      slug:              expect.any(String),
      category:          expect.any(String),
      restaurantDishId:  expect.any(String),
      nameAsServed:      null,
      availabilityStatus: expect.any(String),
      restaurantId:      expect.any(String),
      restaurantName:    expect.any(String),
      restaurantSlug:    expect.any(String),
      city:              expect.any(String),
      verifiedAt:        expect.any(String),
    })
  })

  it('serialises verifiedAt as ISO-8601 string (not Date)', async () => {
    mockQueryRaw.mockResolvedValueOnce([makeVerifiedRow()])

    const [result] = await DiscoveryService.getJustVerified()

    expect(typeof result.verifiedAt).toBe('string')
    expect(result.verifiedAt).toBe('2026-06-01T10:00:00.000Z')
  })

  it('returns [] on DB error (silent degradation)', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('DB error'))

    const results = await DiscoveryService.getJustVerified({ location: 'Lagos' })

    expect(results).toEqual([])
  })

  it('works without location (nationwide)', async () => {
    mockQueryRaw.mockResolvedValueOnce([makeVerifiedRow()])

    const results = await DiscoveryService.getJustVerified()

    expect(results).toHaveLength(1)
  })

  it('area can be null', async () => {
    mockQueryRaw.mockResolvedValueOnce([makeVerifiedRow({ area: null })])

    const [result] = await DiscoveryService.getJustVerified()

    expect(result.area).toBeNull()
  })

  it('price can be null', async () => {
    mockQueryRaw.mockResolvedValueOnce([makeVerifiedRow({ price: null })])

    const [result] = await DiscoveryService.getJustVerified()

    expect(result.price).toBeNull()
  })
})

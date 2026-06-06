// GET /api/v1/search/dishes/[dishId]/restaurants — route tests
//
// Coverage:
//   ✓ Valid request → 200 with { restaurants, total, page }
//   ✓ dishId from path segment forwarded to service
//   ✓ q, city, area, page forwarded to service
//   ✓ q is optional — omitted when absent
//   ✓ page defaults to 1
//   ✓ Response includes restaurantDishId on each result (required for save action)
//   ✓ distanceKm is null on every result (Phase 2 placeholder)
//   ✓ Rate limit exceeded → 429
//   ✓ Rate key is search:{ip}
//   ✓ page=0 → 422 VALIDATION_ERROR
//   ✓ Unexpected service error → 500

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/search/services/dish-restaurant.service', () => ({
  DishRestaurantService: { getDishRestaurants: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { DishRestaurantService } from 'features/search/services/dish-restaurant.service'

const mockRateLimit       = checkRateLimit as ReturnType<typeof vi.fn>
const mockGetRestaurants  = DishRestaurantService.getDishRestaurants as ReturnType<typeof vi.fn>

const MOCK_RESULT = {
  id:                   'rest-1',
  name:                 'Mama Titi Kitchen',
  slug:                 'mama-titi-kitchen',
  city:                 'Lagos',
  area:                 null,
  priceRange:           'MID',
  confidenceScoreBand:  'STRONG',
  thumbnailUrl:         null,
  dishesServed:         6,
  matchedDish: {
    restaurantDishId:    'rd-1',
    nameAsServed:        null,
    availabilityStatus:  'ALWAYS_AVAILABLE',
    price:               null,
  },
  displayScore:  0.72,
  distanceKm:    null,
}

function makeRequest(query = '', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/search/dishes/dt-123/restaurants${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

const MOCK_PARAMS = { params: Promise.resolve({ dishId: 'dt-123' }) }

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetRestaurants.mockResolvedValue({ results: [MOCK_RESULT], total: 1 })
})

afterEach(() => vi.clearAllMocks())

describe('happy path', () => {
  it('returns 200 on a valid request', async () => {
    const res = await GET(makeRequest(), MOCK_PARAMS)
    expect(res.status).toBe(200)
  })

  it('response has restaurants array, total, and page', async () => {
    const res = await GET(makeRequest(), MOCK_PARAMS)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      restaurants: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
    })
  })

  it('each result includes restaurantDishId (required for save action)', async () => {
    const res = await GET(makeRequest(), MOCK_PARAMS)
    const body = await res.json()
    expect(body.data.restaurants[0].matchedDish.restaurantDishId).toBe('rd-1')
  })

  it('each result has distanceKm: null (Phase 2 placeholder)', async () => {
    const res = await GET(makeRequest(), MOCK_PARAMS)
    const body = await res.json()
    expect(body.data.restaurants[0].distanceKm).toBeNull()
  })

  it('forwards dishId from path segment to service', async () => {
    await GET(makeRequest(), MOCK_PARAMS)
    expect(mockGetRestaurants).toHaveBeenCalledWith(
      'dt-123',
      undefined,
      expect.any(Object),
    )
  })

  it('forwards city to service', async () => {
    await GET(makeRequest('?city=Lagos'), MOCK_PARAMS)
    expect(mockGetRestaurants).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ city: 'Lagos' }),
    )
  })

  it('forwards area to service', async () => {
    await GET(makeRequest('?area=Lekki'), MOCK_PARAMS)
    expect(mockGetRestaurants).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ area: 'Lekki' }),
    )
  })

  it('forwards page to service', async () => {
    await GET(makeRequest('?page=2'), MOCK_PARAMS)
    expect(mockGetRestaurants).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ page: 2 }),
    )
  })

  it('defaults page to 1', async () => {
    await GET(makeRequest(), MOCK_PARAMS)
    expect(mockGetRestaurants).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ page: 1 }),
    )
  })

  it('q is optional — service called without q when absent', async () => {
    await GET(makeRequest(), MOCK_PARAMS)
    expect(mockGetRestaurants).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.any(Object),
    )
  })

  it('q forwarded to service when provided', async () => {
    await GET(makeRequest('?q=jollof+rice'), MOCK_PARAMS)
    expect(mockGetRestaurants).toHaveBeenCalledWith(
      expect.any(String),
      'jollof rice',
      expect.any(Object),
    )
  })
})

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest(), MOCK_PARAMS)
    expect(res.status).toBe(429)
  })

  it('rate key is search:{ip}', async () => {
    await GET(makeRequest('', '3.3.3.3'), MOCK_PARAMS)
    expect(mockRateLimit).toHaveBeenCalledWith(
      'search:3.3.3.3',
      expect.any(Number),
      expect.any(Number),
    )
  })
})

describe('validation errors', () => {
  it('returns 422 when page=0', async () => {
    const res = await GET(makeRequest('?page=0'), MOCK_PARAMS)
    expect(res.status).toBe(422)
  })

  it('does not call service when params invalid', async () => {
    await GET(makeRequest('?page=0'), MOCK_PARAMS)
    expect(mockGetRestaurants).not.toHaveBeenCalled()
  })
})

describe('service error handling', () => {
  it('returns 500 for unexpected service error', async () => {
    mockGetRestaurants.mockRejectedValueOnce(new Error('DB error'))
    const res = await GET(makeRequest(), MOCK_PARAMS)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

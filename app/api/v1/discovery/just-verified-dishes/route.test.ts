// GET /api/v1/discovery/just-verified-dishes — route tests
//
// Coverage:
//   ✓ Valid request → 200 with { dishes, location } shape
//   ✓ Each dish result has all dish-first fields (dishId, restaurantDishId, verifiedAt)
//   ✓ location forwarded to DiscoveryService
//   ✓ limit forwarded; defaults to 6
//   ✓ location: null in response when not provided
//   ✓ Rate limit exceeded → 429
//   ✓ Rate key is discovery:{ip}; limit=30
//   ✓ limit > 8 → 422 VALIDATION_ERROR
//   ✓ Unexpected service error → 500

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/search/services/discovery.service', () => ({
  DiscoveryService: { getJustVerified: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { DiscoveryService } from 'features/search/services/discovery.service'

const mockRateLimit       = checkRateLimit as ReturnType<typeof vi.fn>
const mockGetJustVerified = DiscoveryService.getJustVerified as ReturnType<typeof vi.fn>

const MOCK_RESULT = {
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
  verifiedAt:        '2026-06-01T10:00:00.000Z',
}

function makeRequest(query = '', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/discovery/just-verified-dishes${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetJustVerified.mockResolvedValue([MOCK_RESULT])
})

afterEach(() => vi.clearAllMocks())

describe('happy path', () => {
  it('returns 200 on a valid request', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('response has dishes and location fields', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      dishes:   expect.any(Array),
      location: null,
    })
  })

  it('each dish result has all required dish-first fields', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    const dish = body.data.dishes[0]

    expect(dish).toMatchObject({
      dishId:            expect.any(String),
      canonicalName:     expect.any(String),
      slug:              expect.any(String),
      category:          expect.any(String),
      restaurantDishId:  expect.any(String),
      availabilityStatus: expect.any(String),
      restaurantId:      expect.any(String),
      restaurantName:    expect.any(String),
      restaurantSlug:    expect.any(String),
      city:              expect.any(String),
      verifiedAt:        expect.any(String),
    })
  })

  it('forwards location to DiscoveryService', async () => {
    await GET(makeRequest('?location=Lagos'))
    expect(mockGetJustVerified).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Lagos' }),
    )
  })

  it('forwards limit to DiscoveryService', async () => {
    await GET(makeRequest('?limit=4'))
    expect(mockGetJustVerified).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 4 }),
    )
  })

  it('defaults limit to 6', async () => {
    await GET(makeRequest())
    expect(mockGetJustVerified).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 6 }),
    )
  })

  it('location: null in response when not provided', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.location).toBeNull()
  })

  it('dish name is the primary field (dishes-first)', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    const dish = body.data.dishes[0]
    // canonicalName and dishId should be present; restaurantName is secondary
    expect(dish.canonicalName).toBeDefined()
    expect(dish.restaurantName).toBeDefined()
    // canonical name is 'Jollof Rice', restaurant name is context
    expect(dish.canonicalName).toBe('Jollof Rice')
    expect(dish.restaurantName).toBe('Mama Titi Kitchen')
  })
})

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })

  it('rate key is discovery:{ip}', async () => {
    await GET(makeRequest('', '6.6.6.6'))
    expect(mockRateLimit).toHaveBeenCalledWith(
      'discovery:6.6.6.6',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('rate limit is 30 requests', async () => {
    await GET(makeRequest())
    const [, limit] = mockRateLimit.mock.calls[0]
    expect(limit).toBe(30)
  })
})

describe('validation errors', () => {
  it('returns 422 when limit > 8', async () => {
    const res = await GET(makeRequest('?limit=9'))
    expect(res.status).toBe(422)
  })

  it('does not call service when params invalid', async () => {
    await GET(makeRequest('?limit=9'))
    expect(mockGetJustVerified).not.toHaveBeenCalled()
  })
})

describe('service error handling', () => {
  it('returns 500 for unexpected service error', async () => {
    mockGetJustVerified.mockRejectedValueOnce(new Error('Cache error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

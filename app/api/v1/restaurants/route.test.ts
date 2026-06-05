// GET /api/v1/restaurants — route tests
//
// Coverage goals (restaurant-listing-track.md §12.4, §5.1):
//   ✓ Valid request (no filters) → 200 with paginated response shape
//   ✓ restaurants array returned as data
//   ✓ pagination meta contains total, page, limit
//   ✓ Service called with default params when no query string
//   ✓ city filter passed through to service
//   ✓ priceRange filter passed through to service
//   ✓ page + limit query params parsed and forwarded
//   ✓ Rate limit exceeded → 429 with Retry-After header
//   ✓ Service not called when rate limited
//   ✓ Rate key is restaurants:{ip}
//   ✓ Invalid priceRange → 422 VALIDATION_ERROR
//   ✓ Non-integer page → 422 VALIDATION_ERROR
//   ✓ limit out of range (0) → 422 VALIDATION_ERROR
//   ✓ limit out of range (> 20) → 422 VALIDATION_ERROR
//   ✓ Unknown service error → 500 INTERNAL_ERROR

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PriceRange } from '@prisma/client'
import { NextRequest } from 'next/server'
import { GET } from './route'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/restaurants/services/restaurant-listing.service', () => ({
  RestaurantListingService: { getRestaurantIndex: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'

const mockRateLimit      = checkRateLimit as ReturnType<typeof vi.fn>
const mockGetIndex       = RestaurantListingService.getRestaurantIndex as ReturnType<typeof vi.fn>

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CARD = {
  id:                  'r1',
  name:                'Mama Titi Kitchen',
  slug:                'mama-titi-kitchen',
  city:                'Lagos',
  area:                'Lekki',
  priceRange:          PriceRange.MID,
  cuisineTypes:        ['Nigerian'],
  confidenceScoreBand: 'STRONG',
  thumbnailUrl:        'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  thumbnailBlurHash:   'L~I=|jofxuof~qWBt7WB_3j[xtj[',
  dishCount:           5,
}

const MOCK_INDEX_RESULT = {
  restaurants: [MOCK_CARD],
  total:       1,
  page:        1,
  limit:       12,
  totalPages:  1,
}

function makeRequest(query = '', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/restaurants${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetIndex.mockResolvedValue(MOCK_INDEX_RESULT)
})

afterEach(() => vi.clearAllMocks())

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns 200 on a valid request with no query params', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('response envelope has success: true', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('data field is the restaurants array', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].slug).toBe('mama-titi-kitchen')
  })

  it('meta contains total, page, limit', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 12 })
  })

  it('calls service with default page and limit when no query params', async () => {
    await GET(makeRequest())
    expect(mockGetIndex).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 12 }),
    )
  })

  it('response includes trust-band and thumbnail fields on each card', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    const card = body.data[0]
    expect(card.confidenceScoreBand).toBe('STRONG')
    expect(card.thumbnailUrl).toBeDefined()
    expect(card.thumbnailBlurHash).toBeDefined()
  })

  it('raw confidence score is never exposed', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    const card = body.data[0]
    expect(card.confidenceScore).toBeUndefined()
  })
})

// ─── Filter forwarding ────────────────────────────────────────────────────────

describe('filter forwarding', () => {
  it('forwards city filter to service', async () => {
    await GET(makeRequest('?city=Lagos'))
    expect(mockGetIndex).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Lagos' }),
    )
  })

  it('forwards priceRange filter to service', async () => {
    await GET(makeRequest('?priceRange=BUDGET'))
    expect(mockGetIndex).toHaveBeenCalledWith(
      expect.objectContaining({ priceRange: PriceRange.BUDGET }),
    )
  })

  it('forwards page and limit to service', async () => {
    await GET(makeRequest('?page=2&limit=8'))
    expect(mockGetIndex).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 8 }),
    )
  })

  it('returns correct page and limit in meta when custom pagination provided', async () => {
    mockGetIndex.mockResolvedValueOnce({
      restaurants: [],
      total: 30,
      page: 2,
      limit: 8,
      totalPages: 4,
    })
    const res = await GET(makeRequest('?page=2&limit=8'))
    const body = await res.json()
    expect(body.meta).toEqual({ total: 30, page: 2, limit: 8 })
  })

  it('returns empty restaurants array when no results', async () => {
    mockGetIndex.mockResolvedValueOnce({
      restaurants: [], total: 0, page: 1, limit: 12, totalPages: 0,
    })
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.meta.total).toBe(0)
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })

  it('includes Retry-After header on 429', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 60_000 })
    const res = await GET(makeRequest())
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  it('service is not called when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await GET(makeRequest())
    expect(mockGetIndex).not.toHaveBeenCalled()
  })

  it('rate key is restaurants:{ip}', async () => {
    await GET(makeRequest('', '9.9.9.9'))
    expect(mockRateLimit).toHaveBeenCalledWith(
      'restaurants:9.9.9.9',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('rate limit window is 60 seconds', async () => {
    await GET(makeRequest())
    const [, , windowMs] = mockRateLimit.mock.calls[0]
    expect(windowMs).toBe(60_000)
  })

  it('rate limit allows 60 requests per window', async () => {
    await GET(makeRequest())
    const [, limit] = mockRateLimit.mock.calls[0]
    expect(limit).toBe(60)
  })
})

// ─── Validation errors ────────────────────────────────────────────────────────

describe('validation errors', () => {
  it('returns 422 for an unrecognised priceRange value', async () => {
    const res = await GET(makeRequest('?priceRange=LUXURY'))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 when page is a non-numeric string', async () => {
    const res = await GET(makeRequest('?page=abc'))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 when page is 0', async () => {
    const res = await GET(makeRequest('?page=0'))
    expect(res.status).toBe(422)
  })

  it('returns 422 when limit is 0', async () => {
    const res = await GET(makeRequest('?limit=0'))
    expect(res.status).toBe(422)
  })

  it('returns 422 when limit exceeds 20', async () => {
    const res = await GET(makeRequest('?limit=21'))
    expect(res.status).toBe(422)
  })

  it('does not call service when query params are invalid', async () => {
    await GET(makeRequest('?priceRange=BOGUS'))
    expect(mockGetIndex).not.toHaveBeenCalled()
  })
})

// ─── Service error handling ───────────────────────────────────────────────────

describe('service error handling', () => {
  it('returns 500 INTERNAL_ERROR for an unexpected service error', async () => {
    mockGetIndex.mockRejectedValueOnce(new Error('Database connection lost'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// GET /api/v1/restaurants/:slug/dishes — route tests
//
// Coverage goals (restaurant-listing-track.md §12.3, §5.1):
//   ✓ Valid approved slug → 200 with paginated dish list
//   ✓ success: true in response envelope
//   ✓ data is the dishes array
//   ✓ meta contains total, page, limit
//   ✓ getRestaurantDishes called with restaurant id from resolved profile
//   ✓ getRestaurantDishes called with default page/limit when no query params
//   ✓ category filter forwarded to service
//   ✓ page + limit query params forwarded to service
//   ✓ meta reflects service pagination response
//   ✓ empty dishes array when restaurant has no dishes
//   ✓ getRestaurantProfile called with slug from route params
//   ✓ getRestaurantProfile null → 404 NOT_FOUND (unknown slug)
//   ✓ getRestaurantProfile null → 404 NOT_FOUND (non-approved) — identical body
//   ✓ getRestaurantDishes null → 404 NOT_FOUND (defence-in-depth)
//   ✓ no admin fields in dish shape (no verifiedAt, no deletedAt)
//   ✓ isAdminVerified present in dish shape
//   ✓ invalid category query param → 422 VALIDATION_ERROR
//   ✓ invalid page (non-numeric) → 422 VALIDATION_ERROR
//   ✓ page = 0 → 422 VALIDATION_ERROR
//   ✓ limit > 20 → 422 VALIDATION_ERROR
//   ✓ service not called on validation error
//   ✓ rate limit exceeded → 429 with Retry-After header
//   ✓ service not called when rate limited
//   ✓ rate key is restaurant-dishes:{ip}
//   ✓ rate limit is 60 per window
//   ✓ rate window is 60 seconds
//   ✓ unknown server error → 500 INTERNAL_ERROR

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DishCategory, DishAvailabilityStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { GET } from './route'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/restaurants/services/restaurant-listing.service', () => ({
  RestaurantListingService: {
    getRestaurantProfile: vi.fn(),
    getRestaurantDishes:  vi.fn(),
  },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'

const mockRateLimit      = checkRateLimit as ReturnType<typeof vi.fn>
const mockGetProfile     = RestaurantListingService.getRestaurantProfile as ReturnType<typeof vi.fn>
const mockGetDishes      = RestaurantListingService.getRestaurantDishes  as ReturnType<typeof vi.fn>

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SLUG          = 'mama-titi-kitchen'
const RESTAURANT_ID = 'r-uuid-001'

const MOCK_PROFILE = {
  id:   RESTAURANT_ID,
  name: 'Mama Titi Kitchen',
  slug: SLUG,
  // remaining profile fields omitted — route only needs id
}

const MOCK_DISH = {
  id:                 'd1',
  canonicalName:      'Jollof Rice',
  nameAsServed:       'Party Jollof',
  availabilityStatus: DishAvailabilityStatus.ALWAYS_AVAILABLE,
  price:              '2500',
  isAdminVerified:    true,
  category:           DishCategory.RICE_DISHES,
}

const MOCK_DISHES_RESULT = {
  dishes:     [MOCK_DISH],
  total:      1,
  page:       1,
  limit:      20,
  totalPages: 1,
}

function makeRequest(slug = SLUG, query = '', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/restaurants/${slug}/dishes${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

function makeParams(slug = SLUG) {
  return { params: Promise.resolve({ slug }) }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetProfile.mockResolvedValue(MOCK_PROFILE)
  mockGetDishes.mockResolvedValue(MOCK_DISHES_RESULT)
})

afterEach(() => vi.clearAllMocks())

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns 200 for a valid approved slug', async () => {
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
  })

  it('response envelope has success: true', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('data is the dishes array', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].canonicalName).toBe('Jollof Rice')
  })

  it('meta contains total, page, limit', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('getRestaurantProfile called with slug from route params', async () => {
    await GET(makeRequest(), makeParams())
    expect(mockGetProfile).toHaveBeenCalledOnce()
    expect(mockGetProfile).toHaveBeenCalledWith(SLUG)
  })

  it('getRestaurantDishes called with restaurant id from resolved profile', async () => {
    await GET(makeRequest(), makeParams())
    expect(mockGetDishes).toHaveBeenCalledOnce()
    expect(mockGetDishes).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.any(Object),
    )
  })

  it('getRestaurantDishes called with default page and limit when no query params', async () => {
    await GET(makeRequest(), makeParams())
    expect(mockGetDishes).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ page: 1, limit: 20 }),
    )
  })

  it('dish shape includes isAdminVerified flag', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data[0].isAdminVerified).toBe(true)
  })

  it('dish shape does not include raw verifiedAt timestamp', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data[0].verifiedAt).toBeUndefined()
  })

  it('dish shape does not include deletedAt', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data[0].deletedAt).toBeUndefined()
  })
})

// ─── Filter and pagination forwarding ────────────────────────────────────────

describe('filter and pagination forwarding', () => {
  it('forwards category filter to getRestaurantDishes', async () => {
    await GET(makeRequest(SLUG, '?category=RICE_DISHES'), makeParams())
    expect(mockGetDishes).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ category: DishCategory.RICE_DISHES }),
    )
  })

  it('forwards page and limit to getRestaurantDishes', async () => {
    await GET(makeRequest(SLUG, '?page=2&limit=10'), makeParams())
    expect(mockGetDishes).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ page: 2, limit: 10 }),
    )
  })

  it('meta reflects service pagination response', async () => {
    mockGetDishes.mockResolvedValueOnce({
      dishes: [], total: 45, page: 3, limit: 10, totalPages: 5,
    })
    const res = await GET(makeRequest(SLUG, '?page=3&limit=10'), makeParams())
    const body = await res.json()
    expect(body.meta).toEqual({ total: 45, page: 3, limit: 10 })
  })

  it('returns empty dishes array when restaurant has no dishes', async () => {
    mockGetDishes.mockResolvedValueOnce({
      dishes: [], total: 0, page: 1, limit: 20, totalPages: 0,
    })
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.meta.total).toBe(0)
  })
})

// ─── 404 handling ─────────────────────────────────────────────────────────────

describe('404 handling', () => {
  it('returns 404 when getRestaurantProfile returns null (unknown slug)', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    const res = await GET(makeRequest('no-such-slug'), makeParams('no-such-slug'))
    expect(res.status).toBe(404)
  })

  it('404 response has NOT_FOUND error code', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('unknown slug and non-approved slug produce identical 404 bodies — no disclosure', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    const res1 = await GET(makeRequest('does-not-exist'), makeParams('does-not-exist'))

    mockGetProfile.mockResolvedValueOnce(null)
    const res2 = await GET(makeRequest('pending-restaurant'), makeParams('pending-restaurant'))

    expect(res1.status).toBe(404)
    expect(res2.status).toBe(404)
    const [body1, body2] = await Promise.all([res1.json(), res2.json()])
    expect(body1.error.code).toBe(body2.error.code)
    expect(body1.error.message).toBe(body2.error.message)
  })

  it('getRestaurantDishes not called when profile lookup returns null', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    await GET(makeRequest(), makeParams())
    expect(mockGetDishes).not.toHaveBeenCalled()
  })

  it('returns 404 when getRestaurantDishes returns null (defence-in-depth)', async () => {
    mockGetDishes.mockResolvedValueOnce(null)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

// ─── Validation errors ────────────────────────────────────────────────────────

describe('validation errors', () => {
  it('returns 422 for an unrecognised category value', async () => {
    const res = await GET(makeRequest(SLUG, '?category=BURGERS'), makeParams())
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 when page is a non-numeric string', async () => {
    const res = await GET(makeRequest(SLUG, '?page=abc'), makeParams())
    expect(res.status).toBe(422)
  })

  it('returns 422 when page is 0', async () => {
    const res = await GET(makeRequest(SLUG, '?page=0'), makeParams())
    expect(res.status).toBe(422)
  })

  it('returns 422 when limit exceeds 20', async () => {
    const res = await GET(makeRequest(SLUG, '?limit=21'), makeParams())
    expect(res.status).toBe(422)
  })

  it('getRestaurantDishes not called when query params are invalid', async () => {
    await GET(makeRequest(SLUG, '?category=INVALID'), makeParams())
    expect(mockGetDishes).not.toHaveBeenCalled()
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(429)
  })

  it('includes Retry-After header on 429', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 45_000 })
    const res = await GET(makeRequest(), makeParams())
    expect(res.headers.get('Retry-After')).toBe('45')
  })

  it('service not called when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await GET(makeRequest(), makeParams())
    expect(mockGetProfile).not.toHaveBeenCalled()
    expect(mockGetDishes).not.toHaveBeenCalled()
  })

  it('rate key is restaurant-dishes:{ip}', async () => {
    await GET(makeRequest(SLUG, '', '7.7.7.7'), makeParams())
    expect(mockRateLimit).toHaveBeenCalledWith(
      'restaurant-dishes:7.7.7.7',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('rate limit is 60 requests per window', async () => {
    await GET(makeRequest(), makeParams())
    const [, limit] = mockRateLimit.mock.calls[0]
    expect(limit).toBe(60)
  })

  it('rate window is 60 seconds', async () => {
    await GET(makeRequest(), makeParams())
    const [, , windowMs] = mockRateLimit.mock.calls[0]
    expect(windowMs).toBe(60_000)
  })
})

// ─── Server error handling ────────────────────────────────────────────────────

describe('server error handling', () => {
  it('returns 500 INTERNAL_ERROR for an unexpected service error', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('DB timeout'))
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

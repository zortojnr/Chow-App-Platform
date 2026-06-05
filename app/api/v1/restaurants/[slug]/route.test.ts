// GET /api/v1/restaurants/:slug — route tests
//
// Coverage goals (restaurant-listing-track.md §5.1, §7.2, §12.1):
//   ✓ Valid approved slug → 200 with full profile
//   ✓ success: true in response envelope
//   ✓ confidenceScoreBand present in response
//   ✓ verificationBadge is 'VERIFIED'
//   ✓ raw confidenceScore is never exposed
//   ✓ admin fields absent (verificationStatus, internalNotes, deletedAt)
//   ✓ photos array included (service enforces isVerified filter)
//   ✓ dishes array included
//   ✓ submittedAt and approvedAt ISO-8601 strings present
//   ✓ service called with slug from route params
//   ✓ service returns null → 404 NOT_FOUND
//   ✓ null covers both "not found" and "not approved" — no distinction exposed
//   ✓ Rate limit exceeded → 429 with Retry-After header
//   ✓ service not called when rate limited
//   ✓ rate key is restaurant-profile:{ip}
//   ✓ rate limit is 120 per window
//   ✓ rate window is 60 seconds
//   ✓ unknown server error → 500 INTERNAL_ERROR

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PriceRange, DishAvailabilityStatus, DishCategory } from '@prisma/client'
import { NextRequest } from 'next/server'
import { GET } from './route'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/restaurants/services/restaurant-listing.service', () => ({
  RestaurantListingService: { getRestaurantProfile: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { RestaurantListingService } from 'features/restaurants/services/restaurant-listing.service'

const mockRateLimit      = checkRateLimit as ReturnType<typeof vi.fn>
const mockGetProfile     = RestaurantListingService.getRestaurantProfile as ReturnType<typeof vi.fn>

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SLUG = 'mama-titi-kitchen'

const MOCK_PROFILE = {
  id:                  'r1',
  name:                'Mama Titi Kitchen',
  slug:                SLUG,
  description:         'Authentic Nigerian home cooking in the heart of Lekki.',
  phone:               '08012345678',
  address:             '15 Balogun Street, Lekki',
  area:                'Lekki Phase 1',
  city:                'Lagos',
  state:               'Lagos',
  priceRange:          PriceRange.MID,
  cuisineTypes:        ['Nigerian', 'Yoruba'],
  website:             null,
  email:               null,
  confidenceScoreBand: 'STRONG',
  verificationBadge:   'VERIFIED',
  photos: [
    { id: 'p1', url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isPrimary: true },
  ],
  dishes: [
    {
      id:                 'd1',
      canonicalName:      'Jollof Rice',
      nameAsServed:       'Party Jollof',
      availabilityStatus: DishAvailabilityStatus.ALWAYS_AVAILABLE,
      price:              '2500',
      isAdminVerified:    true,
      category:           DishCategory.RICE_DISHES,
    },
  ],
  submittedAt: '2026-01-01T00:00:00.000Z',
  approvedAt:  '2026-01-15T00:00:00.000Z',
}

function makeRequest(slug = SLUG, ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/restaurants/${slug}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

function makeParams(slug = SLUG) {
  return { params: { slug } }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetProfile.mockResolvedValue(MOCK_PROFILE)
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

  it('data contains the full restaurant profile', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.id).toBe('r1')
    expect(body.data.name).toBe('Mama Titi Kitchen')
    expect(body.data.slug).toBe(SLUG)
  })

  it('confidenceScoreBand is present', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.confidenceScoreBand).toBe('STRONG')
  })

  it('verificationBadge is VERIFIED', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.verificationBadge).toBe('VERIFIED')
  })

  it('raw confidenceScore is never exposed', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.confidenceScore).toBeUndefined()
  })

  it('admin-internal field verificationStatus is absent', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.verificationStatus).toBeUndefined()
  })

  it('admin-internal field internalNotes is absent', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.internalNotes).toBeUndefined()
  })

  it('admin-internal field deletedAt is absent', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.deletedAt).toBeUndefined()
  })

  it('photos array is included', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.photos).toHaveLength(1)
    expect(body.data.photos[0].isPrimary).toBe(true)
  })

  it('dishes array is included', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.dishes).toHaveLength(1)
    expect(body.data.dishes[0].canonicalName).toBe('Jollof Rice')
  })

  it('dishes include isAdminVerified flag', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.dishes[0].isAdminVerified).toBe(true)
  })

  it('submittedAt and approvedAt are ISO-8601 strings', async () => {
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.submittedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(body.data.approvedAt).toBe('2026-01-15T00:00:00.000Z')
  })

  it('calls service with the slug from route params', async () => {
    await GET(makeRequest(), makeParams())
    expect(mockGetProfile).toHaveBeenCalledOnce()
    expect(mockGetProfile).toHaveBeenCalledWith(SLUG)
  })
})

// ─── 404 handling ─────────────────────────────────────────────────────────────

describe('404 handling', () => {
  it('returns 404 when service returns null', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('404 response has NOT_FOUND error code', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns same 404 for unknown slug and non-approved slug — no disclosure', async () => {
    // Service returns null for both cases; route must not distinguish them
    mockGetProfile.mockResolvedValueOnce(null)
    const res1 = await GET(makeRequest('slug-does-not-exist'), makeParams('slug-does-not-exist'))
    expect(res1.status).toBe(404)

    mockGetProfile.mockResolvedValueOnce(null)
    const res2 = await GET(makeRequest('pending-restaurant'), makeParams('pending-restaurant'))
    expect(res2.status).toBe(404)

    const [body1, body2] = await Promise.all([res1.json(), res2.json()])
    expect(body1.error.code).toBe(body2.error.code)
    expect(body1.error.message).toBe(body2.error.message)
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 15_000 })
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(429)
  })

  it('includes Retry-After header on 429', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest(), makeParams())
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('service is not called when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await GET(makeRequest(), makeParams())
    expect(mockGetProfile).not.toHaveBeenCalled()
  })

  it('rate key is restaurant-profile:{ip}', async () => {
    await GET(makeRequest(SLUG, '5.6.7.8'), makeParams())
    expect(mockRateLimit).toHaveBeenCalledWith(
      'restaurant-profile:5.6.7.8',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('rate limit is 120 requests per window', async () => {
    await GET(makeRequest(), makeParams())
    const [, limit] = mockRateLimit.mock.calls[0]
    expect(limit).toBe(120)
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
    mockGetProfile.mockRejectedValueOnce(new Error('Database unreachable'))
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

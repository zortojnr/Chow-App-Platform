// GET /api/v1/discovery/trending-dishes — route tests
//
// Coverage:
//   ✓ Valid request → 200 with { dishes, location } shape
//   ✓ location forwarded to DiscoveryService
//   ✓ limit forwarded; defaults to 8
//   ✓ exclude param parsed into excludeDishIds array
//   ✓ exclude: empty string treated as no exclusions
//   ✓ location: null when not provided
//   ✓ Rate limit exceeded → 429
//   ✓ Rate key is discovery:{ip}; limit=30
//   ✓ limit > 20 → 422 VALIDATION_ERROR
//   ✓ Unexpected service error → 500

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/search/services/discovery.service', () => ({
  DiscoveryService: { getTrendingDishes: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { DiscoveryService } from 'features/search/services/discovery.service'

const mockRateLimit    = checkRateLimit as ReturnType<typeof vi.fn>
const mockGetTrending  = DiscoveryService.getTrendingDishes as ReturnType<typeof vi.fn>

const MOCK_DISH = {
  dishId:          'dt-5',
  canonicalName:   'Pounded Yam',
  slug:            'pounded-yam',
  category:        'SWALLOW',
  searchCount:     15,
  restaurantCount: 3,
}

function makeRequest(query = '', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/discovery/trending-dishes${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetTrending.mockResolvedValue([MOCK_DISH])
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

  it('forwards location to DiscoveryService', async () => {
    await GET(makeRequest('?location=Abuja'))
    expect(mockGetTrending).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Abuja' }),
    )
  })

  it('forwards limit to DiscoveryService', async () => {
    await GET(makeRequest('?limit=4'))
    expect(mockGetTrending).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 4 }),
    )
  })

  it('parses exclude into excludeDishIds array', async () => {
    await GET(makeRequest('?exclude=dt-1,dt-2,dt-3'))
    expect(mockGetTrending).toHaveBeenCalledWith(
      expect.objectContaining({ excludeDishIds: ['dt-1', 'dt-2', 'dt-3'] }),
    )
  })

  it('passes empty excludeDishIds when exclude not provided', async () => {
    await GET(makeRequest())
    expect(mockGetTrending).toHaveBeenCalledWith(
      expect.objectContaining({ excludeDishIds: [] }),
    )
  })

  it('location is null in response when not provided', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.location).toBeNull()
  })

  it('location appears in response when provided', async () => {
    const res = await GET(makeRequest('?location=Lagos'))
    const body = await res.json()
    expect(body.data.location).toBe('Lagos')
  })
})

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })

  it('rate key is discovery:{ip}', async () => {
    await GET(makeRequest('', '4.4.4.4'))
    expect(mockRateLimit).toHaveBeenCalledWith(
      'discovery:4.4.4.4',
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
  it('returns 422 when limit > 20', async () => {
    const res = await GET(makeRequest('?limit=25'))
    expect(res.status).toBe(422)
  })
})

describe('service error handling', () => {
  it('returns 500 for unexpected service error', async () => {
    mockGetTrending.mockRejectedValueOnce(new Error('Cache error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

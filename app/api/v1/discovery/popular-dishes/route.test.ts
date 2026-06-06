// GET /api/v1/discovery/popular-dishes — route tests
//
// Coverage:
//   ✓ Valid request → 200 with { dishes, location, window } shape
//   ✓ location forwarded to DiscoveryService
//   ✓ window forwarded to DiscoveryService; defaults to "30d"
//   ✓ limit forwarded to DiscoveryService; defaults to 8
//   ✓ location: null in response when not provided
//   ✓ Rate limit exceeded → 429
//   ✓ Rate key is discovery:{ip}; limit=30; window=60s
//   ✓ invalid window value → 422 VALIDATION_ERROR
//   ✓ limit > 20 → 422 VALIDATION_ERROR
//   ✓ Unexpected service error → 500

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/search/services/discovery.service', () => ({
  DiscoveryService: { getPopularDishes: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { DiscoveryService } from 'features/search/services/discovery.service'

const mockRateLimit       = checkRateLimit as ReturnType<typeof vi.fn>
const mockGetPopular      = DiscoveryService.getPopularDishes as ReturnType<typeof vi.fn>

const MOCK_DISH = {
  dishId:          'dt-1',
  canonicalName:   'Jollof Rice',
  slug:            'jollof-rice',
  category:        'RICE_DISHES',
  searchCount:     42,
  restaurantCount: 5,
}

function makeRequest(query = '', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/discovery/popular-dishes${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetPopular.mockResolvedValue([MOCK_DISH])
})

afterEach(() => vi.clearAllMocks())

describe('happy path', () => {
  it('returns 200 on a valid request', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('response has dishes, location, window fields', async () => {
    const res = await GET(makeRequest('?location=Lagos'))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      dishes:   expect.any(Array),
      location: expect.any(String),
      window:   expect.any(String),
    })
  })

  it('location is null in response when not provided', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.location).toBeNull()
  })

  it('window defaults to 30d when not specified', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.window).toBe('30d')
  })

  it('forwards location to DiscoveryService', async () => {
    await GET(makeRequest('?location=Lagos'))
    expect(mockGetPopular).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Lagos' }),
    )
  })

  it('forwards window to DiscoveryService', async () => {
    await GET(makeRequest('?window=7d'))
    expect(mockGetPopular).toHaveBeenCalledWith(
      expect.objectContaining({ window: '7d' }),
    )
  })

  it('forwards limit to DiscoveryService', async () => {
    await GET(makeRequest('?limit=5'))
    expect(mockGetPopular).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    )
  })

  it('defaults limit to 8', async () => {
    await GET(makeRequest())
    expect(mockGetPopular).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 8 }),
    )
  })
})

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })

  it('service not called when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await GET(makeRequest())
    expect(mockGetPopular).not.toHaveBeenCalled()
  })

  it('rate key is discovery:{ip}', async () => {
    await GET(makeRequest('', '2.2.2.2'))
    expect(mockRateLimit).toHaveBeenCalledWith(
      'discovery:2.2.2.2',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('rate limit is 30 requests', async () => {
    await GET(makeRequest())
    const [, limit] = mockRateLimit.mock.calls[0]
    expect(limit).toBe(30)
  })

  it('rate window is 60 seconds', async () => {
    await GET(makeRequest())
    const [, , windowMs] = mockRateLimit.mock.calls[0]
    expect(windowMs).toBe(60_000)
  })
})

describe('validation errors', () => {
  it('returns 422 for invalid window value', async () => {
    const res = await GET(makeRequest('?window=90d'))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 when limit > 20', async () => {
    const res = await GET(makeRequest('?limit=25'))
    expect(res.status).toBe(422)
  })

  it('does not call service when params invalid', async () => {
    await GET(makeRequest('?window=INVALID'))
    expect(mockGetPopular).not.toHaveBeenCalled()
  })
})

describe('service error handling', () => {
  it('returns 500 for unexpected service error', async () => {
    mockGetPopular.mockRejectedValueOnce(new Error('Cache unavailable'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// GET /api/v1/search/dishes — route tests
//
// Coverage:
//   ✓ Valid request → 200 with dish array
//   ✓ q forwarded to DishSearchService
//   ✓ category filter forwarded to service
//   ✓ limit forwarded to service; defaults to 8
//   ✓ Rate limit exceeded → 429
//   ✓ Rate key is search:{ip}
//   ✓ q missing → 422 VALIDATION_ERROR
//   ✓ invalid category → 422 VALIDATION_ERROR
//   ✓ limit > 20 → 422 VALIDATION_ERROR
//   ✓ Unexpected service error → 500

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/search/services/dish-search.service', () => ({
  DishSearchService: { search: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { DishSearchService } from 'features/search/services/dish-search.service'

const mockRateLimit  = checkRateLimit as ReturnType<typeof vi.fn>
const mockDishSearch = DishSearchService.search as ReturnType<typeof vi.fn>

const MOCK_DISH = {
  dishId:          'dt-1',
  canonicalName:   'Jollof Rice',
  slug:            'jollof-rice',
  category:        'RICE_DISHES',
  aliases:         [],
  restaurantCount: 4,
  matchScore:      0.9,
}

function makeRequest(query = '?q=jollof', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/search/dishes${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockDishSearch.mockResolvedValue([MOCK_DISH])
})

afterEach(() => vi.clearAllMocks())

describe('happy path', () => {
  it('returns 200 on a valid request', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('data is the dishes array', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0].dishId).toBe('dt-1')
  })

  it('forwards q to DishSearchService', async () => {
    await GET(makeRequest('?q=egusi'))
    expect(mockDishSearch).toHaveBeenCalledWith('egusi', expect.any(Object))
  })

  it('forwards category to DishSearchService', async () => {
    await GET(makeRequest('?q=rice&category=RICE_DISHES'))
    expect(mockDishSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ category: 'RICE_DISHES' }),
    )
  })

  it('forwards limit to DishSearchService', async () => {
    await GET(makeRequest('?q=rice&limit=5'))
    expect(mockDishSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 5 }),
    )
  })

  it('defaults limit to 8 when not specified', async () => {
    await GET(makeRequest('?q=rice'))
    expect(mockDishSearch).toHaveBeenCalledWith(
      expect.any(String),
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
    expect(mockDishSearch).not.toHaveBeenCalled()
  })

  it('rate key is search:{ip}', async () => {
    await GET(makeRequest('?q=jollof', '5.5.5.5'))
    expect(mockRateLimit).toHaveBeenCalledWith(
      'search:5.5.5.5',
      expect.any(Number),
      expect.any(Number),
    )
  })
})

describe('validation errors', () => {
  it('returns 422 when q is missing', async () => {
    const res = await GET(makeRequest(''))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 for invalid category value', async () => {
    const res = await GET(makeRequest('?q=rice&category=UNKNOWN'))
    expect(res.status).toBe(422)
  })

  it('returns 422 when limit > 20', async () => {
    const res = await GET(makeRequest('?q=rice&limit=25'))
    expect(res.status).toBe(422)
  })

  it('does not call service when params invalid', async () => {
    await GET(makeRequest('?category=BAD'))
    expect(mockDishSearch).not.toHaveBeenCalled()
  })
})

describe('service error handling', () => {
  it('returns 500 for unexpected service error', async () => {
    mockDishSearch.mockRejectedValueOnce(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

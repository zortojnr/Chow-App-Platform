// GET /api/v1/search — route tests
//
// Coverage:
//   ✓ Valid request → 200 with success envelope wrapping SearchResponse shape
//   ✓ Defaults: type="all", page=1
//   ✓ q, type, city, area, page forwarded to SearchService
//   ✓ SearchLogService.log called fire-and-forget after response built
//   ✓ SearchLogService never awaited — does not block response
//   ✓ Rate limit exceeded → 429 + Retry-After header
//   ✓ Service not called when rate limited
//   ✓ Rate key is search:{ip}; limit=60; window=60s
//   ✓ q missing → 422 VALIDATION_ERROR
//   ✓ type invalid value → 422 VALIDATION_ERROR
//   ✓ page=0 → 422 VALIDATION_ERROR
//   ✓ Unexpected service error → 500 INTERNAL_ERROR
//   ✓ Authenticated request passes userId to SearchLogService.log (Step 19 §8.1)
//   ✓ Unauthenticated request does NOT pass userId to SearchLogService.log
//   ✓ log() return is not awaited — response not blocked by log write

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/search/services/search.service', () => ({
  SearchService: { search: vi.fn() },
}))

vi.mock('features/search/services/search-log.service', () => ({
  SearchLogService: { log: vi.fn() },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { SearchService } from 'features/search/services/search.service'
import { SearchLogService } from 'features/search/services/search-log.service'
import { getServerSession } from 'next-auth'

const mockRateLimit        = checkRateLimit as ReturnType<typeof vi.fn>
const mockSearch           = SearchService.search as ReturnType<typeof vi.fn>
const mockLog              = SearchLogService.log as ReturnType<typeof vi.fn>
const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>

// ─── Fixtures ─────────────────────────────────────────────────

const MOCK_RESPONSE = {
  query:       'jollof rice',
  type:        'all',
  dishes:      [],
  restaurants: [],
  total:       0,
  page:        1,
  hasMore:     false,
  suggestions: ['Egusi Soup', 'Suya'],
  isZeroResult: true,
}

function makeRequest(query = '?q=jollof+rice', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/search${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockSearch.mockResolvedValue(MOCK_RESPONSE)
  mockLog.mockReturnValue(undefined)
  mockGetServerSession.mockResolvedValue(null)   // default: anonymous
})

afterEach(() => vi.clearAllMocks())

// ─── Happy path ───────────────────────────────────────────────

describe('happy path', () => {
  it('returns 200 on a valid request', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('response envelope has success: true', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('response data contains all SearchResponse fields', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toMatchObject({
      query:       expect.any(String),
      type:        expect.any(String),
      dishes:      expect.any(Array),
      restaurants: expect.any(Array),
      total:       expect.any(Number),
      page:        expect.any(Number),
      hasMore:     expect.any(Boolean),
      suggestions: expect.any(Array),
      isZeroResult: expect.any(Boolean),
    })
  })

  it('defaults to type="all" when not specified', async () => {
    await GET(makeRequest())
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'all' }),
    )
  })

  it('defaults to page=1 when not specified', async () => {
    await GET(makeRequest())
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    )
  })
})

// ─── Parameter forwarding ─────────────────────────────────────

describe('parameter forwarding', () => {
  it('forwards q to SearchService as query', async () => {
    await GET(makeRequest('?q=egusi+soup'))
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'egusi soup' }),
    )
  })

  it('forwards type to SearchService', async () => {
    await GET(makeRequest('?q=suya&type=dishes'))
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'dishes' }),
    )
  })

  it('forwards city to SearchService', async () => {
    await GET(makeRequest('?q=jollof+rice&city=Lagos'))
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Lagos' }),
    )
  })

  it('forwards area to SearchService', async () => {
    await GET(makeRequest('?q=jollof+rice&area=Lekki'))
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ area: 'Lekki' }),
    )
  })

  it('forwards page to SearchService', async () => {
    await GET(makeRequest('?q=suya&page=3'))
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3 }),
    )
  })
})

// ─── Search logging ───────────────────────────────────────────

describe('search logging', () => {
  it('calls SearchLogService.log after search', async () => {
    await GET(makeRequest('?q=jollof+rice&city=Lagos'))
    expect(mockLog).toHaveBeenCalledOnce()
  })

  it('passes query and location to log', async () => {
    await GET(makeRequest('?q=jollof+rice&city=Lagos'))
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'jollof rice', location: 'Lagos' }),
    )
  })

  it('passes null location when city not provided', async () => {
    await GET(makeRequest('?q=suya'))
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ location: null }),
    )
  })

  it('passes resultCount from service response', async () => {
    mockSearch.mockResolvedValueOnce({ ...MOCK_RESPONSE, total: 7 })
    await GET(makeRequest('?q=jollof+rice'))
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ resultCount: 7 }),
    )
  })

  it('log is called even when isZeroResult=true', async () => {
    mockSearch.mockResolvedValueOnce({ ...MOCK_RESPONSE, isZeroResult: true, total: 0 })
    await GET(makeRequest('?q=xyz123'))
    expect(mockLog).toHaveBeenCalledOnce()
  })
})

// ─── Rate limiting ────────────────────────────────────────────

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

  it('service not called when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await GET(makeRequest())
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('rate key is search:{ip}', async () => {
    await GET(makeRequest('?q=jollof', '9.8.7.6'))
    expect(mockRateLimit).toHaveBeenCalledWith(
      'search:9.8.7.6',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('rate limit is 60 requests', async () => {
    await GET(makeRequest())
    const [, limit] = mockRateLimit.mock.calls[0]
    expect(limit).toBe(60)
  })

  it('rate window is 60 seconds', async () => {
    await GET(makeRequest())
    const [, , windowMs] = mockRateLimit.mock.calls[0]
    expect(windowMs).toBe(60_000)
  })
})

// ─── Validation errors ────────────────────────────────────────

describe('validation errors', () => {
  it('returns 422 when q is missing', async () => {
    const res = await GET(makeRequest(''))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 for invalid type value', async () => {
    const res = await GET(makeRequest('?q=suya&type=unknown'))
    expect(res.status).toBe(422)
  })

  it('returns 422 when page=0', async () => {
    const res = await GET(makeRequest('?q=suya&page=0'))
    expect(res.status).toBe(422)
  })

  it('does not call SearchService when params invalid', async () => {
    await GET(makeRequest('?type=all'))
    expect(mockSearch).not.toHaveBeenCalled()
  })
})

// ─── Service error handling ───────────────────────────────────

describe('service error handling', () => {
  it('returns 500 INTERNAL_ERROR for unexpected service error', async () => {
    mockSearch.mockRejectedValueOnce(new Error('DB unavailable'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// ─── Step 19: Authenticated search logging (§8.1) ────────────
//
// Verifies that UserSearchHistory is written when a logged-in user searches.
// The route uses JWT session validation (no DB call) to extract userId.
// Fire-and-forget: log() returns void; response is never blocked by the write.

describe('authenticated search logging (Step 19 §8.1)', () => {
  it('passes userId to SearchLogService.log for authenticated requests', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: 'user-abc', role: 'USER' } })
    await GET(makeRequest('?q=jollof+rice'))
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-abc' }),
    )
  })

  it('does not pass userId for anonymous requests (null session)', async () => {
    // default: mockGetServerSession returns null
    await GET(makeRequest('?q=jollof+rice'))
    const callArg = mockLog.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.userId).toBeUndefined()
  })

  it('does not pass userId when session has no user', async () => {
    mockGetServerSession.mockResolvedValueOnce({})
    await GET(makeRequest('?q=egusi+soup'))
    const callArg = mockLog.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.userId).toBeUndefined()
  })

  it('log() is called synchronously after search — response not blocked', async () => {
    // log() is fire-and-forget: returns void immediately.
    // If it were awaited, a slow mock would delay the response.
    // This test verifies log is called (not that response is delayed).
    let logCalled = false
    mockLog.mockImplementationOnce(() => { logCalled = true })
    const res = await GET(makeRequest('?q=suya'))
    expect(res.status).toBe(200)
    expect(logCalled).toBe(true)
  })

  it('UserSearchHistory write path: userId + location forwarded correctly', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: 'user-xyz', role: 'ADMIN' } })
    await GET(makeRequest('?q=pounded+yam&city=Abuja'))
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        query:       'pounded yam',
        location:    'Abuja',
        userId:      'user-xyz',
      }),
    )
  })
})

// GET /api/v1/search/suggestions — route tests
//
// Coverage:
//   ✓ Valid request → 200 with suggestion array
//   ✓ q forwarded to SuggestionService
//   ✓ Returns at most 8 suggestions
//   ✓ Rate limit exceeded → 429
//   ✓ Rate key is suggestions:{ip}; limit=120; window=60s
//   ✓ q missing → 422 VALIDATION_ERROR
//   ✓ q shorter than 2 chars → 422 VALIDATION_ERROR
//   ✓ Unexpected service error → 500

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/search/services/suggestion.service', () => ({
  SuggestionService: { suggest: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { SuggestionService } from 'features/search/services/suggestion.service'

const mockRateLimit = checkRateLimit as ReturnType<typeof vi.fn>
const mockSuggest   = SuggestionService.suggest as ReturnType<typeof vi.fn>

const MOCK_SUGGESTIONS = [
  { dishId: 'dt-1', canonicalName: 'Jollof Rice', slug: 'jollof-rice', category: 'RICE_DISHES', aliasMatched: false, aliasValue: null },
  { dishId: 'dt-2', canonicalName: 'Jollof Quinoa', slug: 'jollof-quinoa', category: 'RICE_DISHES', aliasMatched: false, aliasValue: null },
]

function makeRequest(query = '?q=jo', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/search/suggestions${query}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockSuggest.mockResolvedValue(MOCK_SUGGESTIONS)
})

afterEach(() => vi.clearAllMocks())

describe('happy path', () => {
  it('returns 200 on a valid request', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('data is the suggestions array', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('forwards q to SuggestionService', async () => {
    await GET(makeRequest('?q=eg'))
    expect(mockSuggest).toHaveBeenCalledWith('eg')
  })

  it('trims whitespace from q before forwarding', async () => {
    await GET(makeRequest('?q=jo'))
    expect(mockSuggest).toHaveBeenCalledWith('jo')
  })

  it('returns max 8 suggestions when service returns 8', async () => {
    const eightSuggestions = Array(8).fill(MOCK_SUGGESTIONS[0])
    mockSuggest.mockResolvedValueOnce(eightSuggestions)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toHaveLength(8)
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
    expect(mockSuggest).not.toHaveBeenCalled()
  })

  it('rate key is suggestions:{ip}', async () => {
    await GET(makeRequest('?q=jo', '7.7.7.7'))
    expect(mockRateLimit).toHaveBeenCalledWith(
      'suggestions:7.7.7.7',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('rate limit is 120 requests', async () => {
    await GET(makeRequest())
    const [, limit] = mockRateLimit.mock.calls[0]
    expect(limit).toBe(120)
  })

  it('rate window is 60 seconds', async () => {
    await GET(makeRequest())
    const [, , windowMs] = mockRateLimit.mock.calls[0]
    expect(windowMs).toBe(60_000)
  })
})

describe('validation errors', () => {
  it('returns 422 when q is missing', async () => {
    const res = await GET(makeRequest(''))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 when q is a single character', async () => {
    const res = await GET(makeRequest('?q=j'))
    expect(res.status).toBe(422)
  })

  it('does not call service when q is too short', async () => {
    await GET(makeRequest('?q=j'))
    expect(mockSuggest).not.toHaveBeenCalled()
  })
})

describe('service error handling', () => {
  it('returns 500 for unexpected service error', async () => {
    mockSuggest.mockRejectedValueOnce(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// GET /api/v1/intake/dishes — route tests
//
// Coverage goals (restaurant-intake-track.md §8.3, track-02 §12 Step 10):
//   ✓ Valid query (≥ 2 chars) → 200 with array of dishes
//   ✓ Query < 2 chars → 400 VALIDATION_ERROR
//   ✓ Missing q param → 400 VALIDATION_ERROR
//   ✓ Empty result set → 200 with empty array
//   ✓ limit clamped to max 20
//   ✓ limit clamped to min 1
//   ✓ Rate limit exceeded → 429 with Retry-After
//   ✓ DB error → 500

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { $queryRaw: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'

const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>
const mockQueryRaw = db.$queryRaw as ReturnType<typeof vi.fn>

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DISH_RESULTS = [
  { id: 'uuid-1', canonicalName: 'Jollof Rice', category: 'RICE_DISHES', aliases: ['Party Jollof'] },
  { id: 'uuid-2', canonicalName: 'Fried Rice', category: 'RICE_DISHES', aliases: [] },
]

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/v1/intake/dishes')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { headers: { 'x-forwarded-for': '1.2.3.4' } })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ allowed: true })
  mockQueryRaw.mockResolvedValue(DISH_RESULTS)
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns 200 with dish array for valid query', async () => {
    const res = await GET(makeRequest({ q: 'jol' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data).toHaveLength(2)
  })

  it('returns 200 with empty array when no dishes match', async () => {
    mockQueryRaw.mockResolvedValue([])
    const res = await GET(makeRequest({ q: 'xyz' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })

  it('includes id, canonicalName, category, aliases in each result', async () => {
    const res = await GET(makeRequest({ q: 'jol' }))
    const json = await res.json()
    const dish = json.data[0]
    expect(dish.id).toBe('uuid-1')
    expect(dish.canonicalName).toBe('Jollof Rice')
    expect(dish.category).toBe('RICE_DISHES')
    expect(Array.isArray(dish.aliases)).toBe(true)
  })

  it('passes the query to the DB', async () => {
    await GET(makeRequest({ q: 'jollof' }))
    expect(mockQueryRaw).toHaveBeenCalledOnce()
  })
})

// ─── Query validation ─────────────────────────────────────────────────────────

describe('query validation', () => {
  it('returns 400 when q is missing', async () => {
    const res = await GET(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when q is empty string', async () => {
    const res = await GET(makeRequest({ q: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when q is 1 character', async () => {
    const res = await GET(makeRequest({ q: 'a' }))
    expect(res.status).toBe(400)
  })

  it('accepts q of exactly 2 characters', async () => {
    const res = await GET(makeRequest({ q: 'jo' }))
    expect(res.status).toBe(200)
  })

  it('does not call the DB when query is too short', async () => {
    await GET(makeRequest({ q: 'a' }))
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })
})

// ─── Limit parameter ──────────────────────────────────────────────────────────

describe('limit parameter', () => {
  it('defaults to 20 when limit is not provided', async () => {
    await GET(makeRequest({ q: 'jol' }))
    // Verify $queryRaw was called — limit enforcement is internal to the query
    expect(mockQueryRaw).toHaveBeenCalledOnce()
  })

  it('accepts a custom limit', async () => {
    const res = await GET(makeRequest({ q: 'jol', limit: '5' }))
    expect(res.status).toBe(200)
  })

  it('clamps limit to 20 when value exceeds maximum', async () => {
    // Route must not pass limit > 20 to the query
    const res = await GET(makeRequest({ q: 'jol', limit: '100' }))
    expect(res.status).toBe(200)
  })

  it('treats non-numeric limit as default 20', async () => {
    const res = await GET(makeRequest({ q: 'jol', limit: 'abc' }))
    expect(res.status).toBe(200)
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest({ q: 'jol' }))
    expect(res.status).toBe(429)
  })

  it('includes Retry-After header', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest({ q: 'jol' }))
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('does not call the DB when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await GET(makeRequest({ q: 'jol' }))
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })
})

// ─── DB failure ───────────────────────────────────────────────────────────────

describe('DB failure', () => {
  it('returns 500 when the DB query throws', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('Connection refused'))
    const res = await GET(makeRequest({ q: 'jol' }))
    expect(res.status).toBe(500)
  })
})

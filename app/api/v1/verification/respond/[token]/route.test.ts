// POST /api/v1/verification/respond/[token] — route tests
//
// Coverage goals (track-02 §9.2, §7.3, Step 13 exit criteria):
//   ✓ Valid token + valid body → 200 with confirmation message
//   ✓ Rate limit exceeded → 429 with Retry-After header
//   ✓ Rate limit key uses respond:<sha256(token)>, not IP
//   ✓ Rate limit checked before token validation (fast-fail)
//   ✓ Malformed JSON body → 400 VALIDATION_ERROR
//   ✓ Empty responseText → 422 VALIDATION_ERROR
//   ✓ responseText exceeding 5000 chars → 422 VALIDATION_ERROR
//   ✓ additionalPhotoIds exceeding 5 → 422 VALIDATION_ERROR
//   ✓ Body validation fires before token validation
//   ✓ Expired token → 400 TOKEN_EXPIRED
//   ✓ Invalid/tampered token → 400 TOKEN_INVALID
//   ✓ Malformed token (not a JWT) → 400 TOKEN_INVALID
//   ✓ Already-used token → 410 TOKEN_USED
//   ✓ Token in path delegated correctly to processSubmitterResponse
//   ✓ additionalPhotoIds forwarded to service
//   ✓ IP forwarded to service
//   ✓ Service ValidationError (state machine rejects transition) → 422
//   ✓ Service NotFoundError → 404
//   ✓ Unknown error → 500 INTERNAL_ERROR

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))

vi.mock('features/verification/services/response-token.service', () => ({
  hashToken:             vi.fn(),
  validateResponseToken: vi.fn(),
  isTokenUsed:           vi.fn(),
}))

vi.mock('features/verification', () => ({
  VerificationService: { processSubmitterResponse: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import {
  hashToken,
  validateResponseToken,
  isTokenUsed,
} from 'features/verification/services/response-token.service'
import { VerificationService } from 'features/verification'

const mockRateLimit  = checkRateLimit             as ReturnType<typeof vi.fn>
const mockHashToken  = hashToken                  as ReturnType<typeof vi.fn>
const mockValidate   = validateResponseToken      as ReturnType<typeof vi.fn>
const mockIsUsed     = isTokenUsed                as ReturnType<typeof vi.fn>
const mockProcess    = VerificationService.processSubmitterResponse as ReturnType<typeof vi.fn>

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RAW_TOKEN    = 'header.payload.signature'
const TOKEN_HASH   = 'abc123hash'
const RESTAURANT_ID = 'rest-uuid-001'
const RECORD_ID     = 'rec-uuid-001'

const VALID_PAYLOAD = {
  valid: true,
  payload: {
    restaurantId:         RESTAURANT_ID,
    verificationRecordId: RECORD_ID,
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
}

const VALID_BODY = { responseText: 'We are open daily from 10am to 10pm.' }

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    `http://localhost/api/v1/verification/respond/${RAW_TOKEN}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body:    typeof body === 'string' ? body : JSON.stringify(body),
    },
  )
}

const PARAMS = { params: Promise.resolve({ token: RAW_TOKEN }) }

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockHashToken.mockReturnValue(TOKEN_HASH)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockValidate.mockResolvedValue(VALID_PAYLOAD)
  mockIsUsed.mockResolvedValue(false)
  mockProcess.mockResolvedValue(undefined)
})

afterEach(() => vi.clearAllMocks())

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns 200 with confirmation message', async () => {
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toContain('re-entered the review queue')
  })

  it('calls processSubmitterResponse with token, responseText, and ip', async () => {
    await POST(makeRequest(VALID_BODY, { 'x-forwarded-for': '5.6.7.8' }), PARAMS)
    expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({
      token:        RAW_TOKEN,
      responseText: VALID_BODY.responseText,
      ipAddress:    '5.6.7.8',
    }))
  })

  it('forwards additionalPhotoIds to service when provided', async () => {
    const body = { ...VALID_BODY, additionalPhotoIds: ['photo-id-1', 'photo-id-2'] }
    await POST(makeRequest(body), PARAMS)
    expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({
      additionalPhotoIds: ['photo-id-1', 'photo-id-2'],
    }))
  })

  it('defaults additionalPhotoIds to [] when omitted', async () => {
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({
      additionalPhotoIds: [],
    }))
  })

  it('falls back to 127.0.0.1 ip when no forwarded-for header', async () => {
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({
      ipAddress: '127.0.0.1',
    }))
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.status).toBe(429)
  })

  it('includes Retry-After header on 429', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 3_600_000 })
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.headers.get('Retry-After')).toBe('3600')
  })

  it('uses respond:<hash> as the rate limit key', async () => {
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockHashToken).toHaveBeenCalledWith(RAW_TOKEN)
    expect(mockRateLimit).toHaveBeenCalledWith(
      `respond:${TOKEN_HASH}`,
      10,
      expect.any(Number),
    )
  })

  it('does not validate token when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('does not call service when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockProcess).not.toHaveBeenCalled()
  })
})

// ─── Body validation ──────────────────────────────────────────────────────────

describe('body validation', () => {
  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeRequest('{not json}'), PARAMS)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 when responseText is missing', async () => {
    const res = await POST(makeRequest({}), PARAMS)
    expect(res.status).toBe(422)
  })

  it('returns 422 when responseText is empty string', async () => {
    const res = await POST(makeRequest({ responseText: '' }), PARAMS)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error.fields['responseText']).toBeDefined()
  })

  it('returns 422 when responseText exceeds 5000 characters', async () => {
    const res = await POST(makeRequest({ responseText: 'a'.repeat(5001) }), PARAMS)
    expect(res.status).toBe(422)
  })

  it('returns 422 when additionalPhotoIds has more than 5 entries', async () => {
    const body = {
      responseText:       VALID_BODY.responseText,
      additionalPhotoIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    }
    const res = await POST(makeRequest(body), PARAMS)
    expect(res.status).toBe(422)
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('body validation fires before token validation', async () => {
    await POST(makeRequest({ responseText: '' }), PARAMS)
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('does not call service for invalid body', async () => {
    await POST(makeRequest({}), PARAMS)
    expect(mockProcess).not.toHaveBeenCalled()
  })
})

// ─── Token validation ─────────────────────────────────────────────────────────

describe('token validation — expired', () => {
  beforeEach(() => {
    mockValidate.mockResolvedValue({ valid: false, reason: 'EXPIRED' })
  })

  it('returns 400 for expired token', async () => {
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.status).toBe(400)
  })

  it('uses code TOKEN_EXPIRED', async () => {
    const json = await (await POST(makeRequest(VALID_BODY), PARAMS)).json()
    expect(json.error.code).toBe('TOKEN_EXPIRED')
  })

  it('does not check replay for expired token', async () => {
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockIsUsed).not.toHaveBeenCalled()
  })

  it('does not call service for expired token', async () => {
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockProcess).not.toHaveBeenCalled()
  })
})

describe('token validation — invalid signature', () => {
  beforeEach(() => {
    mockValidate.mockResolvedValue({ valid: false, reason: 'INVALID_SIGNATURE' })
  })

  it('returns 400', async () => {
    expect((await POST(makeRequest(VALID_BODY), PARAMS)).status).toBe(400)
  })

  it('uses code TOKEN_INVALID', async () => {
    const json = await (await POST(makeRequest(VALID_BODY), PARAMS)).json()
    expect(json.error.code).toBe('TOKEN_INVALID')
  })

  it('does not call service', async () => {
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockProcess).not.toHaveBeenCalled()
  })
})

describe('token validation — malformed token', () => {
  beforeEach(() => {
    mockValidate.mockResolvedValue({ valid: false, reason: 'MALFORMED' })
  })

  it('returns 400', async () => {
    expect((await POST(makeRequest(VALID_BODY), PARAMS)).status).toBe(400)
  })

  it('uses code TOKEN_INVALID (same as invalid signature)', async () => {
    const json = await (await POST(makeRequest(VALID_BODY), PARAMS)).json()
    expect(json.error.code).toBe('TOKEN_INVALID')
  })
})

// ─── Replay prevention ────────────────────────────────────────────────────────

describe('replay prevention', () => {
  beforeEach(() => {
    mockIsUsed.mockResolvedValue(true)
  })

  it('returns 410 when token has already been used', async () => {
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.status).toBe(410)
  })

  it('uses code TOKEN_USED', async () => {
    const json = await (await POST(makeRequest(VALID_BODY), PARAMS)).json()
    expect(json.error.code).toBe('TOKEN_USED')
  })

  it('does not call service when token is already used', async () => {
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockProcess).not.toHaveBeenCalled()
  })

  it('replay check only runs after token signature check passes', async () => {
    mockValidate.mockResolvedValue({ valid: false, reason: 'EXPIRED' })
    await POST(makeRequest(VALID_BODY), PARAMS)
    expect(mockIsUsed).not.toHaveBeenCalled()
  })
})

// ─── Service errors ───────────────────────────────────────────────────────────

describe('service errors', () => {
  it('returns 422 when service throws ValidationError (e.g. state machine rejects transition)', async () => {
    const { ValidationError } = await import('@/lib/errors')
    mockProcess.mockRejectedValue(new ValidationError('Restaurant is not in NEEDS_INFO status'))
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when service throws NotFoundError', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockProcess.mockRejectedValue(new NotFoundError('Restaurant'))
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.status).toBe(404)
  })

  it('returns 500 for unknown errors', async () => {
    mockProcess.mockRejectedValue(new Error('DB connection lost'))
    const res = await POST(makeRequest(VALID_BODY), PARAMS)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

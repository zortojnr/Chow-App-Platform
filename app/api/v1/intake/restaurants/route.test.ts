// POST /api/v1/intake/restaurants — route tests
//
// Coverage goals (restaurant-intake-track.md §8.1, track-02 §12 Step 9 exit criteria):
//   ✓ Valid payload → 201 with submissionId
//   ✓ Malformed JSON → 400 VALIDATION_ERROR (not 500)
//   ✓ Invalid payload (field errors) → 422 with fields map
//   ✓ Exact duplicate → 409 with existingSlug in body
//   ✓ Rate limit exceeded → 429 with Retry-After header
//   ✓ IntakeService ValidationError → 422
//   ✓ Unknown server error → 500 sanitized in production
//   ✓ IP extracted from x-forwarded-for
//   ✓ Rate limit key uses extracted IP
//   ✓ IntakeService called with parsed data and IP

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { ConflictError, ValidationError } from '@/lib/errors'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('features/restaurants/services/intake.service', () => ({
  IntakeService: { submit: vi.fn() },
}))

import { checkRateLimit } from '@/lib/rate-limit'
import { IntakeService } from 'features/restaurants/services/intake.service'

const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>
const mockSubmit = IntakeService.submit as ReturnType<typeof vi.fn>

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SUBMISSION_ID = '550e8400-e29b-41d4-a716-446655440000'

const VALID_BODY = {
  name: 'Mama Titi Kitchen',
  address: '15 Balogun Street, Lagos',
  city: 'Lagos',
  state: 'Lagos',
  phone: '08012345678',
  priceRange: 'MID',
  cuisineTypes: ['Nigerian'],
  dishes: [{ dishId: '123e4567-e89b-12d3-a456-426614174000', availabilityStatus: 'ALWAYS_AVAILABLE' }],
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest('http://localhost/api/v1/intake/restaurants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return req
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ allowed: true })
  mockSubmit.mockResolvedValue({ submissionId: SUBMISSION_ID })
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns 201 with submissionId', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.submissionId).toBe(SUBMISSION_ID)
  })

  it('calls IntakeService.submit with parsed payload', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(mockSubmit).toHaveBeenCalledOnce()
    const [payload] = mockSubmit.mock.calls[0]
    expect(payload.name).toBe('Mama Titi Kitchen')
    expect(payload.city).toBe('Lagos')
  })

  it('passes the client IP to IntakeService.submit', async () => {
    await POST(makeRequest(VALID_BODY, { 'x-forwarded-for': '1.2.3.4' }))
    const [, ip] = mockSubmit.mock.calls[0]
    expect(ip).toBe('1.2.3.4')
  })

  it('extracts first IP when x-forwarded-for is a list', async () => {
    await POST(makeRequest(VALID_BODY, { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))
    const [, ip] = mockSubmit.mock.calls[0]
    expect(ip).toBe('1.2.3.4')
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 3000 })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
  })

  it('includes Retry-After header on 429', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 3600_000 })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.headers.get('Retry-After')).toBe('3600')
  })

  it('does not call IntakeService when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 })
    await POST(makeRequest(VALID_BODY))
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('uses intake:{ip} as the rate limit key', async () => {
    await POST(makeRequest(VALID_BODY, { 'x-forwarded-for': '9.9.9.9' }))
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'intake:9.9.9.9',
      expect.any(Number),
      expect.any(Number),
    )
  })
})

// ─── Malformed JSON ───────────────────────────────────────────────────────────

describe('malformed JSON', () => {
  it('returns 400 VALIDATION_ERROR (not 500) for malformed JSON body', async () => {
    const res = await POST(makeRequest('{not valid json}'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('does not call IntakeService for malformed JSON', async () => {
    await POST(makeRequest('{{broken'))
    expect(mockSubmit).not.toHaveBeenCalled()
  })
})

// ─── Validation errors ────────────────────────────────────────────────────────

describe('validation errors', () => {
  it('returns 422 when required fields are missing', async () => {
    const res = await POST(makeRequest({ name: 'Test' }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('includes field-level errors in the response', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, phone: 'not-a-phone' }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error.fields).toBeDefined()
    expect(json.error.fields.phone).toBeDefined()
  })

  it('returns 422 when phone format is invalid', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, phone: '1234567' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 when dishes array is empty', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, dishes: [] }))
    expect(res.status).toBe(422)
  })

  it('does not call IntakeService for invalid payload', async () => {
    await POST(makeRequest({ name: 'Only name' }))
    expect(mockSubmit).not.toHaveBeenCalled()
  })
})

// ─── Service errors ───────────────────────────────────────────────────────────

describe('service errors', () => {
  it('returns 409 with existingSlug when IntakeService throws ConflictError', async () => {
    mockSubmit.mockRejectedValueOnce(
      new ConflictError('A restaurant with this name already exists in this city', {
        existingSlug: 'mama-titi-kitchen',
      }),
    )
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
    expect(json.error.data.existingSlug).toBe('mama-titi-kitchen')
  })

  it('returns 422 when IntakeService throws ValidationError', async () => {
    mockSubmit.mockRejectedValueOnce(
      new ValidationError('One or more dish IDs are not recognised'),
    )
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 500 with INTERNAL_ERROR code for unknown server errors', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('DB connection lost'))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

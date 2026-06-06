import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  VerificationService: { requestInfo: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { VerificationService } from 'features/verification'

const mockSession     = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit   = checkRateLimit   as ReturnType<typeof vi.fn>
const mockRequestInfo = VerificationService.requestInfo as ReturnType<typeof vi.fn>

const RESTAURANT_ID = 'rest-uuid-001'
const ADMIN_SESSION = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const VALID_BODY    = { feedbackToSubmitter: 'Please provide a clearer photo of the exterior.' }

function makeRequest(body: unknown = VALID_BODY) {
  return new NextRequest(
    `http://localhost/api/v1/admin/verification/${RESTAURANT_ID}/needs-info`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

const PARAMS = { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockRequestInfo.mockResolvedValue(undefined)
})
afterEach(() => vi.clearAllMocks())

describe('POST /api/v1/admin/verification/:restaurantId/needs-info', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await POST(makeRequest(), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await POST(makeRequest(), PARAMS)).status).toBe(403)
  })

  it('returns 422 when feedbackToSubmitter is absent', async () => {
    const res = await POST(makeRequest({}), PARAMS)
    expect(res.status).toBe(422)
    expect(mockRequestInfo).not.toHaveBeenCalled()
  })

  it('returns 422 when feedbackToSubmitter is shorter than 10 characters', async () => {
    const res = await POST(makeRequest({ feedbackToSubmitter: 'Too short' }), PARAMS)
    expect(res.status).toBe(422)
    expect(mockRequestInfo).not.toHaveBeenCalled()
  })

  it('returns 200 on success', async () => {
    expect((await POST(makeRequest(), PARAMS)).status).toBe(200)
  })

  it('passes feedbackToSubmitter to service', async () => {
    await POST(makeRequest(), PARAMS)
    expect(mockRequestInfo).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackToSubmitter: VALID_BODY.feedbackToSubmitter }),
    )
  })

  it('returns 422 when transition is invalid', async () => {
    const { ValidationError } = await import('@/lib/errors')
    mockRequestInfo.mockRejectedValue(new ValidationError('Invalid transition'))
    expect((await POST(makeRequest(), PARAMS)).status).toBe(422)
  })
})

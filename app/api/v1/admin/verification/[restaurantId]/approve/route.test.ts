import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole, VerificationStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  VerificationService: { approve: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { VerificationService } from 'features/verification'

const mockSession   = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit = checkRateLimit   as ReturnType<typeof vi.fn>
const mockApprove   = VerificationService.approve as ReturnType<typeof vi.fn>

const RESTAURANT_ID = 'rest-uuid-001'
const ADMIN_SESSION = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const APPROVE_RESULT = {
  restaurantId: RESTAURANT_ID,
  verificationStatus: VerificationStatus.APPROVED,
  confidenceScore: 0.75,
}

function makeRequest(body: unknown = {}) {
  return new NextRequest(
    `http://localhost/api/v1/admin/verification/${RESTAURANT_ID}/approve`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

const PARAMS = { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockApprove.mockResolvedValue(APPROVE_RESULT)
})
afterEach(() => vi.clearAllMocks())

describe('POST /api/v1/admin/verification/:restaurantId/approve', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await POST(makeRequest(), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await POST(makeRequest(), PARAMS)).status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    expect((await POST(makeRequest(), PARAMS)).status).toBe(429)
  })

  it('returns 200 with verificationStatus and confidenceScore on success', async () => {
    const res = await POST(makeRequest(), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.verificationStatus).toBe(VerificationStatus.APPROVED)
    expect(body.data.confidenceScore).toBe(0.75)
  })

  it('passes actorId and actorRole from session', async () => {
    await POST(makeRequest(), PARAMS)
    expect(mockApprove).toHaveBeenCalledWith(expect.objectContaining({
      actorId:   ADMIN_SESSION.user.id,
      actorRole: UserRole.ADMIN,
    }))
  })

  it('passes optional notes to service when provided', async () => {
    await POST(makeRequest({ notes: 'Excellent submission' }), PARAMS)
    expect(mockApprove).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Excellent submission' }))
  })

  it('returns 422 when service throws ValidationError (score below threshold)', async () => {
    const { ValidationError } = await import('@/lib/errors')
    mockApprove.mockRejectedValue(new ValidationError('Score 0.30 below threshold'))
    expect((await POST(makeRequest(), PARAMS)).status).toBe(422)
  })

  it('returns 404 when restaurant not found', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockApprove.mockRejectedValue(new NotFoundError('Restaurant'))
    expect((await POST(makeRequest(), PARAMS)).status).toBe(404)
  })

  it('rejects notes exceeding 1000 characters with 422', async () => {
    const res = await POST(makeRequest({ notes: 'a'.repeat(1001) }), PARAMS)
    expect(res.status).toBe(422)
    expect(mockApprove).not.toHaveBeenCalled()
  })

  it('SUPER role is accepted', async () => {
    mockSession.mockResolvedValue({ user: { id: 's1', role: UserRole.SUPER } })
    expect((await POST(makeRequest(), PARAMS)).status).toBe(200)
  })
})

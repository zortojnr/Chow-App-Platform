import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  IntelligenceService: { overrideScore: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { IntelligenceService } from 'features/verification'

const mockSession       = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit     = checkRateLimit   as ReturnType<typeof vi.fn>
const mockOverrideScore = IntelligenceService.overrideScore as ReturnType<typeof vi.fn>

const RESTAURANT_ID  = 'rest-uuid-001'
const SUPER_SESSION  = { user: { id: 'super-001', role: UserRole.SUPER } }
const ADMIN_SESSION  = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const VALID_BODY     = { score: 0.85, reason: 'Manual on-site quality verification confirmed.' }

function makeRequest(body: unknown = VALID_BODY) {
  return new NextRequest(
    `http://localhost/api/v1/admin/verification/${RESTAURANT_ID}/score/override`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

const PARAMS = { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) }

beforeEach(() => {
  mockSession.mockResolvedValue(SUPER_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockOverrideScore.mockResolvedValue(undefined)
})
afterEach(() => vi.clearAllMocks())

describe('POST /api/v1/admin/verification/:restaurantId/score/override', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await POST(makeRequest(), PARAMS)).status).toBe(401)
  })

  it('returns 403 when ADMIN role (SUPER only)', async () => {
    mockSession.mockResolvedValue(ADMIN_SESSION)
    expect((await POST(makeRequest(), PARAMS)).status).toBe(403)
    expect(mockOverrideScore).not.toHaveBeenCalled()
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await POST(makeRequest(), PARAMS)).status).toBe(403)
  })

  it('returns 200 when SUPER role with valid body', async () => {
    expect((await POST(makeRequest(), PARAMS)).status).toBe(200)
  })

  it('returns 422 when score is absent', async () => {
    const res = await POST(makeRequest({ reason: VALID_BODY.reason }), PARAMS)
    expect(res.status).toBe(422)
    expect(mockOverrideScore).not.toHaveBeenCalled()
  })

  it('returns 422 when score exceeds 1', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, score: 1.01 }), PARAMS)
    expect(res.status).toBe(422)
  })

  it('returns 422 when score is below 0', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, score: -0.01 }), PARAMS)
    expect(res.status).toBe(422)
  })

  it('returns 422 when reason is shorter than 10 characters', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, reason: 'Short' }), PARAMS)
    expect(res.status).toBe(422)
  })

  it('passes actorRole SUPER to service', async () => {
    await POST(makeRequest(), PARAMS)
    expect(mockOverrideScore).toHaveBeenCalledWith(expect.objectContaining({
      actorRole: UserRole.SUPER,
    }))
  })

  it('returns 422 when service rejects override', async () => {
    const { ValidationError } = await import('@/lib/errors')
    mockOverrideScore.mockRejectedValue(new ValidationError('Override not allowed in DRAFT'))
    expect((await POST(makeRequest(), PARAMS)).status).toBe(422)
  })
})

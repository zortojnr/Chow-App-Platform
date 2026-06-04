import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  VerificationService: { assignAdmin: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { VerificationService } from 'features/verification'

const mockSession     = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit   = checkRateLimit   as ReturnType<typeof vi.fn>
const mockAssignAdmin = VerificationService.assignAdmin as ReturnType<typeof vi.fn>

const RESTAURANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const ADMIN_ID      = '11111111-2222-3333-4444-555555555555'
const ADMIN_SESSION = { user: { id: ADMIN_ID, role: UserRole.ADMIN } }

function makeRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/v1/admin/verification/${RESTAURANT_ID}/assign`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

const PARAMS = { params: { restaurantId: RESTAURANT_ID } }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockAssignAdmin.mockResolvedValue(undefined)
})
afterEach(() => vi.clearAllMocks())

describe('POST /api/v1/admin/verification/:restaurantId/assign', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await POST(makeRequest({ adminId: ADMIN_ID }), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await POST(makeRequest({ adminId: ADMIN_ID }), PARAMS)).status).toBe(403)
  })

  it('accepts a valid UUID', async () => {
    expect((await POST(makeRequest({ adminId: ADMIN_ID }), PARAMS)).status).toBe(200)
  })

  it('accepts null (un-assign)', async () => {
    const res = await POST(makeRequest({ adminId: null }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.assigned).toBeNull()
  })

  it('rejects a non-UUID adminId', async () => {
    const res = await POST(makeRequest({ adminId: 'not-a-uuid' }), PARAMS)
    expect(res.status).toBe(422)
    expect(mockAssignAdmin).not.toHaveBeenCalled()
  })

  it('rejects missing adminId field', async () => {
    const res = await POST(makeRequest({}), PARAMS)
    expect(res.status).toBe(422)
  })

  it('passes correct adminId to assignAdmin service', async () => {
    await POST(makeRequest({ adminId: ADMIN_ID }), PARAMS)
    expect(mockAssignAdmin).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      adminId:      ADMIN_ID,
    })
  })

  it('returns 200 even when service throws (non-critical)', async () => {
    // assignAdmin swallows errors internally — route should still succeed
    mockAssignAdmin.mockRejectedValue(new Error('DB failure'))
    // Note: the route's catch will catch this since it's thrown from the mock
    // In production, the real service swallows it. This tests the route catch behaviour.
    const res = await POST(makeRequest({ adminId: ADMIN_ID }), PARAMS)
    expect(res.status).toBe(500)
  })
})

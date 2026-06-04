import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { NextRequest } from 'next/server'
import { PATCH } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  IntelligenceService: { recalculateRestaurantIntelligence: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { IntelligenceService } from 'features/verification'

const mockSession     = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit   = checkRateLimit   as ReturnType<typeof vi.fn>
const mockRecalculate = IntelligenceService.recalculateRestaurantIntelligence as ReturnType<typeof vi.fn>

const RESTAURANT_ID = 'rest-uuid-001'
const ADMIN_SESSION = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const VALID_BODY    = { description: 'Updated restaurant description that is informative.' }

function makeRequest(body: unknown = VALID_BODY) {
  return new NextRequest(
    `http://localhost/api/v1/admin/restaurants/${RESTAURANT_ID}/intelligence`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

const PARAMS = { params: { restaurantId: RESTAURANT_ID } }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockRecalculate.mockResolvedValue({ restaurantId: RESTAURANT_ID, newScore: 0.75 })
})
afterEach(() => vi.clearAllMocks())

describe('PATCH /api/v1/admin/restaurants/:restaurantId/intelligence', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(403)
  })

  it('returns 422 when body is empty (no fields provided)', async () => {
    const res = await PATCH(makeRequest({}), PARAMS)
    expect(res.status).toBe(422)
    expect(mockRecalculate).not.toHaveBeenCalled()
  })

  it('returns 200 with restaurantId and confidenceScore on success', async () => {
    const res = await PATCH(makeRequest(), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.restaurantId).toBe(RESTAURANT_ID)
    expect(body.data.confidenceScore).toBe(0.75)
  })

  it('passes correct fields to service', async () => {
    await PATCH(makeRequest({ phone: '08012345678' }), PARAMS)
    expect(mockRecalculate).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({ phone: '08012345678' }),
    }))
  })

  it('returns 422 when email is malformed', async () => {
    const res = await PATCH(makeRequest({ email: 'not-valid-email' }), PARAMS)
    expect(res.status).toBe(422)
  })

  it('returns 404 when restaurant not found', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockRecalculate.mockRejectedValue(new NotFoundError('Restaurant'))
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(404)
  })

  it('SUPER role is also accepted', async () => {
    mockSession.mockResolvedValue({ user: { id: 's1', role: UserRole.SUPER } })
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(200)
  })
})

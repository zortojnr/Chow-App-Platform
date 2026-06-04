import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { NextRequest } from 'next/server'
import { PATCH } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  IntelligenceService: { verifyDish: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { IntelligenceService } from 'features/verification'

const mockSession    = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit  = checkRateLimit   as ReturnType<typeof vi.fn>
const mockVerifyDish = IntelligenceService.verifyDish as ReturnType<typeof vi.fn>

const RESTAURANT_ID = 'rest-uuid-001'
const DISH_ID       = 'dish-uuid-001'
const ADMIN_SESSION = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const VERIFY_RESULT = {
  restaurantDishId: DISH_ID,
  restaurantId:     RESTAURANT_ID,
  verifiedAt:       new Date(),
  newScore:         0.75,
}

function makeRequest(body: unknown = {}) {
  return new NextRequest(
    `http://localhost/api/v1/admin/restaurants/${RESTAURANT_ID}/dishes/${DISH_ID}/verify`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

const PARAMS = { params: { restaurantId: RESTAURANT_ID, dishId: DISH_ID } }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockVerifyDish.mockResolvedValue(VERIFY_RESULT)
})
afterEach(() => vi.clearAllMocks())

describe('PATCH /api/v1/admin/restaurants/:restaurantId/dishes/:dishId/verify', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(403)
  })

  it('returns 200 with empty body (all fields optional)', async () => {
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(200)
  })

  it('returns 200 with dish verification result', async () => {
    const res = await PATCH(makeRequest(), PARAMS)
    const body = await res.json()
    expect(body.data.restaurantDishId).toBe(DISH_ID)
    expect(body.data.newScore).toBe(0.75)
  })

  it('passes dishId to service', async () => {
    await PATCH(makeRequest(), PARAMS)
    expect(mockVerifyDish).toHaveBeenCalledWith(expect.objectContaining({
      restaurantDishId: DISH_ID,
    }))
  })

  it('converts verifiedAt string to Date before calling service', async () => {
    await PATCH(makeRequest({ verifiedAt: '2026-06-04T00:00:00.000Z' }), PARAMS)
    const [[call]] = mockVerifyDish.mock.calls
    expect(call.verifiedAt).toBeInstanceOf(Date)
  })

  it('returns 422 when verifiedAt is not a valid datetime', async () => {
    const res = await PATCH(makeRequest({ verifiedAt: 'not-a-date' }), PARAMS)
    expect(res.status).toBe(422)
    expect(mockVerifyDish).not.toHaveBeenCalled()
  })

  it('returns 404 when dish not found', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockVerifyDish.mockRejectedValue(new NotFoundError('RestaurantDish'))
    expect((await PATCH(makeRequest(), PARAMS)).status).toBe(404)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole, DishAvailabilityStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { PATCH } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  IntelligenceService: {
    verifyDish:          vi.fn(),
    updateAvailability:  vi.fn(),
    updatePricing:       vi.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { IntelligenceService } from 'features/verification'

const mockSession           = getServerSession           as ReturnType<typeof vi.fn>
const mockRateLimit         = checkRateLimit             as ReturnType<typeof vi.fn>
const mockVerifyDish        = IntelligenceService.verifyDish        as ReturnType<typeof vi.fn>
const mockUpdateAvailability = IntelligenceService.updateAvailability as ReturnType<typeof vi.fn>
const mockUpdatePricing     = IntelligenceService.updatePricing     as ReturnType<typeof vi.fn>

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
  mockUpdateAvailability.mockResolvedValue(undefined)
  mockUpdatePricing.mockResolvedValue(undefined)
})
afterEach(() => vi.clearAllMocks())

describe('PATCH /api/v1/admin/restaurants/:restaurantId/dishes/:dishId/verify', () => {

  // ── Auth ─────────────────────────────────────────────────────

  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await PATCH(makeRequest({ verifiedAt: new Date().toISOString() }), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await PATCH(makeRequest({ verifiedAt: new Date().toISOString() }), PARAMS)).status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 10_000 })
    expect((await PATCH(makeRequest({ verifiedAt: new Date().toISOString() }), PARAMS)).status).toBe(429)
  })

  // ── Validation ───────────────────────────────────────────────

  it('returns 200 with empty body — no service called', async () => {
    const res = await PATCH(makeRequest({}), PARAMS)
    expect(res.status).toBe(200)
    expect(mockVerifyDish).not.toHaveBeenCalled()
    expect(mockUpdateAvailability).not.toHaveBeenCalled()
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('returns 422 when verifiedAt is not a valid datetime', async () => {
    const res = await PATCH(makeRequest({ verifiedAt: 'not-a-date' }), PARAMS)
    expect(res.status).toBe(422)
    expect(mockVerifyDish).not.toHaveBeenCalled()
  })

  it('returns 422 when availabilityStatus is invalid', async () => {
    const res = await PATCH(makeRequest({ availabilityStatus: 'INVALID_VALUE' }), PARAMS)
    expect(res.status).toBe(422)
  })

  it('returns 422 when price is negative', async () => {
    const res = await PATCH(makeRequest({ price: -100 }), PARAMS)
    expect(res.status).toBe(422)
  })

  // ── verifyDish dispatch ──────────────────────────────────────

  it('calls verifyDish when verifiedAt is provided', async () => {
    const iso = new Date().toISOString()
    await PATCH(makeRequest({ verifiedAt: iso }), PARAMS)
    expect(mockVerifyDish).toHaveBeenCalledWith(expect.objectContaining({
      restaurantDishId: DISH_ID,
    }))
  })

  it('converts verifiedAt string to Date before calling verifyDish', async () => {
    await PATCH(makeRequest({ verifiedAt: '2026-06-04T00:00:00.000Z' }), PARAMS)
    const [[call]] = mockVerifyDish.mock.calls
    expect(call.verifiedAt).toBeInstanceOf(Date)
  })

  it('calls verifyDish when nameAsServed is provided (UD-B: re-confirm)', async () => {
    await PATCH(makeRequest({ nameAsServed: 'Pepper Soup' }), PARAMS)
    expect(mockVerifyDish).toHaveBeenCalledWith(expect.objectContaining({
      restaurantDishId: DISH_ID,
      nameAsServed:     'Pepper Soup',
    }))
  })

  it('returns verifiedAt and newScore from verifyDish result', async () => {
    const res  = await PATCH(makeRequest({ verifiedAt: new Date().toISOString() }), PARAMS)
    const body = await res.json()
    expect(body.data.restaurantDishId).toBe(DISH_ID)
    expect(body.data.newScore).toBe(0.75)
  })

  it('returns 404 when dish not found during verifyDish', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockVerifyDish.mockRejectedValue(new NotFoundError('RestaurantDish'))
    expect((await PATCH(makeRequest({ verifiedAt: new Date().toISOString() }), PARAMS)).status).toBe(404)
  })

  // ── updateAvailability dispatch ──────────────────────────────

  it('calls updateAvailability when availabilityStatus is provided', async () => {
    await PATCH(makeRequest({ availabilityStatus: DishAvailabilityStatus.SEASONAL }), PARAMS)
    expect(mockUpdateAvailability).toHaveBeenCalledWith(expect.objectContaining({
      restaurantDishId:   DISH_ID,
      availabilityStatus: DishAvailabilityStatus.SEASONAL,
    }))
    expect(mockVerifyDish).not.toHaveBeenCalled()
  })

  it('returns availabilityStatus in response', async () => {
    const res  = await PATCH(makeRequest({ availabilityStatus: DishAvailabilityStatus.WEEKEND_ONLY }), PARAMS)
    const body = await res.json()
    expect(body.data.availabilityStatus).toBe(DishAvailabilityStatus.WEEKEND_ONLY)
  })

  it('returns 404 when dish not found during updateAvailability', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockUpdateAvailability.mockRejectedValue(new NotFoundError('RestaurantDish'))
    expect(
      (await PATCH(makeRequest({ availabilityStatus: DishAvailabilityStatus.SEASONAL }), PARAMS)).status
    ).toBe(404)
  })

  // ── updatePricing dispatch ───────────────────────────────────

  it('calls updatePricing when price is provided', async () => {
    await PATCH(makeRequest({ price: 2500 }), PARAMS)
    expect(mockUpdatePricing).toHaveBeenCalledWith(expect.objectContaining({
      restaurantDishId: DISH_ID,
      price:            2500,
    }))
    expect(mockVerifyDish).not.toHaveBeenCalled()
  })

  it('returns price in response', async () => {
    const res  = await PATCH(makeRequest({ price: 1800 }), PARAMS)
    const body = await res.json()
    expect(body.data.price).toBe(1800)
  })

  it('returns 404 when dish not found during updatePricing', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockUpdatePricing.mockRejectedValue(new NotFoundError('RestaurantDish'))
    expect((await PATCH(makeRequest({ price: 1000 }), PARAMS)).status).toBe(404)
  })

  // ── Multiple fields ──────────────────────────────────────────

  it('dispatches to all three services when all fields provided', async () => {
    await PATCH(makeRequest({
      verifiedAt:         new Date().toISOString(),
      availabilityStatus: DishAvailabilityStatus.ALWAYS_AVAILABLE,
      price:              3000,
    }), PARAMS)
    expect(mockVerifyDish).toHaveBeenCalledTimes(1)
    expect(mockUpdateAvailability).toHaveBeenCalledTimes(1)
    expect(mockUpdatePricing).toHaveBeenCalledTimes(1)
  })

  it('does not call verifyDish when only availability and price are provided', async () => {
    await PATCH(makeRequest({
      availabilityStatus: DishAvailabilityStatus.ON_ORDER,
      price:              500,
    }), PARAMS)
    expect(mockVerifyDish).not.toHaveBeenCalled()
    expect(mockUpdateAvailability).toHaveBeenCalledTimes(1)
    expect(mockUpdatePricing).toHaveBeenCalledTimes(1)
  })
})

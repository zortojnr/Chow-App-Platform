import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { NextRequest } from 'next/server'
import { PATCH } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/verification', () => ({
  IntelligenceService: { verifyPhoto: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { IntelligenceService } from 'features/verification'

const mockSession     = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit   = checkRateLimit   as ReturnType<typeof vi.fn>
const mockVerifyPhoto = IntelligenceService.verifyPhoto as ReturnType<typeof vi.fn>

const RESTAURANT_ID  = 'rest-uuid-001'
const PHOTO_ID       = 'photo-uuid-001'
const ADMIN_SESSION  = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const VERIFY_RESULT  = {
  photoId:      PHOTO_ID,
  restaurantId: RESTAURANT_ID,
  isVerified:   true,
  isPrimary:    false,
  newScore:     0.75,
}

function makeRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/v1/admin/restaurants/${RESTAURANT_ID}/photos/${PHOTO_ID}/verify`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

const PARAMS = { params: { restaurantId: RESTAURANT_ID, photoId: PHOTO_ID } }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockVerifyPhoto.mockResolvedValue(VERIFY_RESULT)
})
afterEach(() => vi.clearAllMocks())

describe('PATCH /api/v1/admin/restaurants/:restaurantId/photos/:photoId/verify', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await PATCH(makeRequest({ isVerified: true }), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await PATCH(makeRequest({ isVerified: true }), PARAMS)).status).toBe(403)
  })

  it('returns 422 when isVerified is absent', async () => {
    const res = await PATCH(makeRequest({}), PARAMS)
    expect(res.status).toBe(422)
    expect(mockVerifyPhoto).not.toHaveBeenCalled()
  })

  it('returns 422 when isVerified is not a boolean', async () => {
    const res = await PATCH(makeRequest({ isVerified: 'yes' }), PARAMS)
    expect(res.status).toBe(422)
  })

  it('returns 200 with photo result on success', async () => {
    const res = await PATCH(makeRequest({ isVerified: true }), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.photoId).toBe(PHOTO_ID)
    expect(body.data.isVerified).toBe(true)
  })

  it('passes isVerified and isPrimary to service', async () => {
    await PATCH(makeRequest({ isVerified: true, isPrimary: true }), PARAMS)
    expect(mockVerifyPhoto).toHaveBeenCalledWith(expect.objectContaining({
      isVerified: true,
      isPrimary:  true,
    }))
  })

  it('passes photoId (not restaurantId) to service', async () => {
    await PATCH(makeRequest({ isVerified: false }), PARAMS)
    expect(mockVerifyPhoto).toHaveBeenCalledWith(expect.objectContaining({
      photoId: PHOTO_ID,
    }))
  })

  it('returns 404 when photo not found', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockVerifyPhoto.mockRejectedValue(new NotFoundError('RestaurantPhoto'))
    expect((await PATCH(makeRequest({ isVerified: true }), PARAMS)).status).toBe(404)
  })
})

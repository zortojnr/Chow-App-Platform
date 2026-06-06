import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole, VerificationStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/admin/services/queue.service', () => ({
  QueueService: { getDetail: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { QueueService } from 'features/admin/services/queue.service'

const mockSession   = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit = checkRateLimit   as ReturnType<typeof vi.fn>
const mockGetDetail = QueueService.getDetail as ReturnType<typeof vi.fn>

const RESTAURANT_ID = 'rest-uuid-001'
const ADMIN_SESSION = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const MOCK_DETAIL   = {
  id: RESTAURANT_ID, name: 'Test Restaurant',
  verificationStatus: VerificationStatus.PENDING_REVIEW,
  verification: { id: 'rec-001', events: [] },
  dishes: [], photos: [],
}

function makeRequest() {
  return new NextRequest(`http://localhost/api/v1/admin/verification/${RESTAURANT_ID}`)
}

const PARAMS = { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetDetail.mockResolvedValue(MOCK_DETAIL)
})
afterEach(() => vi.clearAllMocks())

describe('GET /api/v1/admin/verification/:restaurantId', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await GET(makeRequest(), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await GET(makeRequest(), PARAMS)).status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    expect((await GET(makeRequest(), PARAMS)).status).toBe(429)
  })

  it('returns 200 with restaurant detail', async () => {
    const res = await GET(makeRequest(), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(RESTAURANT_ID)
  })

  it('does NOT call any update or write operation (read-only contract)', async () => {
    await GET(makeRequest(), PARAMS)
    expect(mockGetDetail).toHaveBeenCalledWith(RESTAURANT_ID)
    // Only one service call — no write side effects
    expect(mockGetDetail).toHaveBeenCalledOnce()
  })

  it('returns 404 when restaurant not found', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockGetDetail.mockRejectedValue(new NotFoundError('Restaurant'))
    expect((await GET(makeRequest(), PARAMS)).status).toBe(404)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole, VerificationStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/admin/services/queue.service', () => ({
  QueueService: { getHistory: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { QueueService } from 'features/admin/services/queue.service'

const mockSession    = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit  = checkRateLimit   as ReturnType<typeof vi.fn>
const mockGetHistory = QueueService.getHistory as ReturnType<typeof vi.fn>

const RESTAURANT_ID = 'rest-uuid-001'
const ADMIN_SESSION = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const MOCK_EVENTS   = [
  { id: 'evt-001', restaurantId: RESTAURANT_ID, fromStatus: null,
    toStatus: VerificationStatus.DRAFT, actorId: 'SYSTEM',
    actorRole: 'SYSTEM', ipAddress: '127.0.0.1', createdAt: new Date() },
]

function makeRequest() {
  return new NextRequest(`http://localhost/api/v1/admin/verification/${RESTAURANT_ID}/history`)
}

const PARAMS = { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) }

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetHistory.mockResolvedValue(MOCK_EVENTS)
})
afterEach(() => vi.clearAllMocks())

describe('GET /api/v1/admin/verification/:restaurantId/history', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    expect((await GET(makeRequest(), PARAMS)).status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    expect((await GET(makeRequest(), PARAMS)).status).toBe(403)
  })

  it('returns 200 with events array', async () => {
    const res = await GET(makeRequest(), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.events)).toBe(true)
  })

  it('returns 404 when no verification record exists', async () => {
    const { NotFoundError } = await import('@/lib/errors')
    mockGetHistory.mockRejectedValue(new NotFoundError('VerificationRecord'))
    expect((await GET(makeRequest(), PARAMS)).status).toBe(404)
  })

  it('passes restaurantId to service', async () => {
    await GET(makeRequest(), PARAMS)
    expect(mockGetHistory).toHaveBeenCalledWith(RESTAURANT_ID)
  })
})

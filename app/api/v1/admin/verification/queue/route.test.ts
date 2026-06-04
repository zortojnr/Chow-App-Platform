import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UserRole, VerificationStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('features/admin/services/queue.service', () => ({
  QueueService: { getQueue: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { QueueService } from 'features/admin/services/queue.service'

const mockSession    = getServerSession as ReturnType<typeof vi.fn>
const mockRateLimit  = checkRateLimit   as ReturnType<typeof vi.fn>
const mockGetQueue   = QueueService.getQueue as ReturnType<typeof vi.fn>

const ADMIN_SESSION  = { user: { id: 'admin-001', role: UserRole.ADMIN } }
const QUEUE_RESULT   = {
  records: [{ restaurantId: 'r1', restaurantName: 'Test', city: 'Lagos', state: 'Lagos',
    submittedAt: new Date(), currentStatus: VerificationStatus.PENDING_REVIEW,
    confidenceScore: 0.5, assignedTo: null, dishCount: 3, photoCount: 1,
    hasInternalNotes: false, verificationRecordId: 'rec-1' }],
  total: 1, page: 1, limit: 20,
}

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/v1/admin/verification/queue${query}`)
}

beforeEach(() => {
  mockSession.mockResolvedValue(ADMIN_SESSION)
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetQueue.mockResolvedValue(QUEUE_RESULT)
})
afterEach(() => vi.clearAllMocks())

describe('GET /api/v1/admin/verification/queue', () => {
  it('returns 401 when no session', async () => {
    mockSession.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 when USER role', async () => {
    mockSession.mockResolvedValue({ user: { id: 'u1', role: UserRole.USER } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })

  it('returns 200 with paginated response on success', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
  })

  it('rejects invalid status query param with 422', async () => {
    const res = await GET(makeRequest('?status=BOGUS'))
    expect(res.status).toBe(422)
  })

  it('passes parsed status to QueueService', async () => {
    await GET(makeRequest('?status=NEEDS_INFO'))
    expect(mockGetQueue).toHaveBeenCalledWith(
      expect.objectContaining({ status: VerificationStatus.NEEDS_INFO }),
      ADMIN_SESSION.user.id,
    )
  })

  it('passes session adminId to QueueService for "me" resolution', async () => {
    await GET(makeRequest('?assignedTo=me'))
    expect(mockGetQueue).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: 'me' }),
      ADMIN_SESSION.user.id,
    )
  })

  it('SUPER role is also accepted', async () => {
    mockSession.mockResolvedValue({ user: { id: 's1', role: UserRole.SUPER } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })
})

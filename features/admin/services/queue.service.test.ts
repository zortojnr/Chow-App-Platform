// Queue Service — unit tests
//
// All DB calls are mocked. Tests cover:
//   getQueue: filter combinations, assignedTo resolution, pagination math,
//             sort order, result shape mapping
//   getDetail: NotFoundError paths, read-only (no DB writes)
//   getHistory: NotFoundError when no record, correct ordering

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VerificationStatus } from '@prisma/client'
import { QueueService } from './queue.service'
import { NotFoundError } from '@/lib/errors'

vi.mock('@/lib/db', () => ({
  db: {
    verificationRecord: {
      findMany:  vi.fn(),
      count:     vi.fn(),
      findFirst: vi.fn(),
    },
    restaurant: {
      findFirst: vi.fn(),
    },
    verificationEvent: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { db } from '@/lib/db'
const mockDb = db as any

// ─────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin-uuid-001'
const REST_ID  = 'rest-uuid-001'
const REC_ID   = 'rec-uuid-001'

const MOCK_RECORD = {
  id:              REC_ID,
  currentStatus:   VerificationStatus.PENDING_REVIEW,
  confidenceScore: { valueOf: () => 0.5 },
  assignedTo:      null,
  internalNotes:   null,
  createdAt:       new Date('2026-06-01'),
  restaurant: {
    id:        REST_ID,
    name:      'Mama Titi Kitchen',
    city:      'Lagos',
    state:     'Lagos',
    createdAt: new Date('2026-06-01'),
    _count:    { dishes: 3, photos: 2 },
  },
}

const MOCK_RESTAURANT = {
  id:                 REST_ID,
  name:               'Mama Titi Kitchen',
  city:               'Lagos',
  state:              'Lagos',
  verificationStatus: VerificationStatus.APPROVED,
  confidenceScore:    0.75,
  verification: {
    id:     REC_ID,
    events: [],
  },
  dishes: [],
  photos: [],
}

const DEFAULT_PARAMS = {
  status: VerificationStatus.PENDING_REVIEW,
  sort:   'oldest' as const,
  page:   1,
  limit:  20,
}

beforeEach(() => {
  mockDb.$transaction.mockImplementation((ops: any[]) => Promise.all(ops))
  mockDb.verificationRecord.findMany.mockResolvedValue([MOCK_RECORD])
  mockDb.verificationRecord.count.mockResolvedValue(1)
  mockDb.verificationRecord.findFirst.mockResolvedValue({ id: REC_ID })
  mockDb.restaurant.findFirst.mockResolvedValue(MOCK_RESTAURANT)
  mockDb.verificationEvent.findMany.mockResolvedValue([])
})

afterEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────────────────────
// getQueue
// ─────────────────────────────────────────────────────────────

describe('QueueService.getQueue', () => {
  it('uses status from params in where clause', async () => {
    await QueueService.getQueue({ ...DEFAULT_PARAMS, status: VerificationStatus.NEEDS_INFO }, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.where.currentStatus).toBe(VerificationStatus.NEEDS_INFO)
  })

  it('resolves "me" to adminId in assignedTo filter', async () => {
    await QueueService.getQueue({ ...DEFAULT_PARAMS, assignedTo: 'me' }, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.where.assignedTo).toBe(ADMIN_ID)
  })

  it('resolves "unassigned" to null in assignedTo filter', async () => {
    await QueueService.getQueue({ ...DEFAULT_PARAMS, assignedTo: 'unassigned' }, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.where.assignedTo).toBeNull()
  })

  it('passes a concrete UUID through as assignedTo filter', async () => {
    const uuid = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789'
    await QueueService.getQueue({ ...DEFAULT_PARAMS, assignedTo: uuid }, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.where.assignedTo).toBe(uuid)
  })

  it('adds city filter when city is provided', async () => {
    await QueueService.getQueue({ ...DEFAULT_PARAMS, city: 'Abuja' }, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.where.restaurant).toEqual({ city: 'Abuja' })
  })

  it('omits city filter when city is not provided', async () => {
    await QueueService.getQueue(DEFAULT_PARAMS, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.where.restaurant).toBeUndefined()
  })

  it('orders by createdAt asc for "oldest"', async () => {
    await QueueService.getQueue(DEFAULT_PARAMS, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.orderBy).toEqual({ createdAt: 'asc' })
  })

  it('orders by createdAt desc for "newest"', async () => {
    await QueueService.getQueue({ ...DEFAULT_PARAMS, sort: 'newest' }, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('calculates correct skip for page 2 with limit 20', async () => {
    await QueueService.getQueue({ ...DEFAULT_PARAMS, page: 2, limit: 20 }, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.skip).toBe(20)
    expect(findManyCall.take).toBe(20)
  })

  it('calculates correct skip for page 1 (skip = 0)', async () => {
    await QueueService.getQueue(DEFAULT_PARAMS, ADMIN_ID)
    const [[findManyCall]] = mockDb.verificationRecord.findMany.mock.calls
    expect(findManyCall.skip).toBe(0)
  })

  it('runs findMany and count in the same transaction', async () => {
    await QueueService.getQueue(DEFAULT_PARAMS, ADMIN_ID)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it('returns mapped result shape with correct fields', async () => {
    const result = await QueueService.getQueue(DEFAULT_PARAMS, ADMIN_ID)
    expect(result.records).toHaveLength(1)
    const r = result.records[0]
    expect(r.restaurantId).toBe(REST_ID)
    expect(r.restaurantName).toBe('Mama Titi Kitchen')
    expect(r.dishCount).toBe(3)
    expect(r.photoCount).toBe(2)
    expect(r.hasInternalNotes).toBe(false)
  })

  it('sets hasInternalNotes true when internalNotes is non-null', async () => {
    mockDb.verificationRecord.findMany.mockResolvedValue([
      { ...MOCK_RECORD, internalNotes: 'POSSIBLE DUPLICATE: see record abc' },
    ])
    const result = await QueueService.getQueue(DEFAULT_PARAMS, ADMIN_ID)
    expect(result.records[0].hasInternalNotes).toBe(true)
  })

  it('returns pagination meta', async () => {
    mockDb.verificationRecord.count.mockResolvedValue(47)
    const result = await QueueService.getQueue({ ...DEFAULT_PARAMS, page: 3, limit: 10 }, ADMIN_ID)
    expect(result.total).toBe(47)
    expect(result.page).toBe(3)
    expect(result.limit).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────
// getDetail
// ─────────────────────────────────────────────────────────────

describe('QueueService.getDetail', () => {
  it('returns the restaurant when found', async () => {
    const result = await QueueService.getDetail(REST_ID)
    expect(result.id).toBe(REST_ID)
  })

  it('throws NotFoundError when restaurant does not exist', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue(null)
    await expect(QueueService.getDetail(REST_ID)).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when verification record is missing', async () => {
    mockDb.restaurant.findFirst.mockResolvedValue({ ...MOCK_RESTAURANT, verification: null })
    await expect(QueueService.getDetail(REST_ID)).rejects.toThrow(NotFoundError)
  })

  it('does NOT call verificationRecord.update (read-only)', async () => {
    await QueueService.getDetail(REST_ID)
    expect(mockDb.verificationRecord.update).toBeUndefined()
  })

  it('does NOT open a transaction', async () => {
    await QueueService.getDetail(REST_ID)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// getHistory
// ─────────────────────────────────────────────────────────────

describe('QueueService.getHistory', () => {
  it('throws NotFoundError when no verification record exists', async () => {
    mockDb.verificationRecord.findFirst.mockResolvedValue(null)
    await expect(QueueService.getHistory(REST_ID)).rejects.toThrow(NotFoundError)
  })

  it('returns events ordered by createdAt asc', async () => {
    await QueueService.getHistory(REST_ID)
    const [[findManyCall]] = mockDb.verificationEvent.findMany.mock.calls
    expect(findManyCall.orderBy).toEqual({ createdAt: 'asc' })
  })

  it('filters events by restaurantId', async () => {
    await QueueService.getHistory(REST_ID)
    const [[findManyCall]] = mockDb.verificationEvent.findMany.mock.calls
    expect(findManyCall.where).toEqual({ restaurantId: REST_ID })
  })

  it('returns all events without pagination', async () => {
    await QueueService.getHistory(REST_ID)
    const [[findManyCall]] = mockDb.verificationEvent.findMany.mock.calls
    expect(findManyCall.take).toBeUndefined()
    expect(findManyCall.skip).toBeUndefined()
  })
})

// Admin Queue Service — read-only queries for the admin verification workflow.
//
// Responsibilities:
//   getQueue   — paginated + filtered list of VerificationRecords for the queue table
//   getDetail  — full restaurant data for the review screen (READ ONLY)
//   getHistory — append-only VerificationEvent log for a restaurant
//
// Assignment (VerificationRecord.assignedTo) is NOT a side effect of getDetail.
// Assignment is explicit via VerificationService.assignAdmin(), called by the
// POST /assign route after a GET /detail fetch.
//
// Rationale for read-only GET: HTTP GET must be idempotent. A GET with a write
// side effect is broken by caching, prefetch, and monitoring tools.
//
// DB client: `db` (standard client with soft-delete filtering).
// Governed by: admin-platform-track.md §4.1, track-02 §9.3, backend-standards.md §2

import { db } from '@/lib/db'
import { NotFoundError } from '@/lib/errors'
import type { QueueQueryInput } from 'features/admin/schemas/queue.schema'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type QueueResult = {
  records: QueueRecord[]
  total:   number
  page:    number
  limit:   number
}

export type QueueRecord = {
  verificationRecordId: string
  restaurantId:         string
  restaurantName:       string
  city:                 string
  state:                string
  submittedAt:          Date
  currentStatus:        string
  confidenceScore:      number
  assignedTo:           string | null
  dishCount:            number
  photoCount:           number
  hasInternalNotes:     boolean
}

// ─────────────────────────────────────────────────────────────
// QUEUE
// ─────────────────────────────────────────────────────────────

export const QueueService = {

  async getQueue(params: QueueQueryInput, adminId: string): Promise<QueueResult> {
    const assignedToFilter =
      params.assignedTo === 'me'          ? { assignedTo: adminId } :
      params.assignedTo === 'unassigned'  ? { assignedTo: null }    :
      params.assignedTo                   ? { assignedTo: params.assignedTo } :
      {}

    const where = {
      currentStatus: params.status,
      ...assignedToFilter,
      ...(params.city ? { restaurant: { city: params.city } } : {}),
    }

    const [records, total] = await db.$transaction([
      db.verificationRecord.findMany({
        where,
        select: {
          id:             true,
          currentStatus:  true,
          confidenceScore: true,
          assignedTo:     true,
          internalNotes:  true,
          createdAt:      true,
          restaurant: {
            select: {
              id:    true,
              name:  true,
              city:  true,
              state: true,
              createdAt: true,
              _count: {
                select: {
                  dishes: { where: { deletedAt: null } },
                  photos: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: params.sort === 'newest' ? 'desc' : 'asc' },
        skip:    (params.page - 1) * params.limit,
        take:    params.limit,
      }),
      db.verificationRecord.count({ where }),
    ])

    return {
      records: records.map((r) => ({
        verificationRecordId: r.id,
        restaurantId:         r.restaurant.id,
        restaurantName:       r.restaurant.name,
        city:                 r.restaurant.city,
        state:                r.restaurant.state,
        submittedAt:          r.restaurant.createdAt,
        currentStatus:        r.currentStatus,
        confidenceScore:      Number(r.confidenceScore),
        assignedTo:           r.assignedTo,
        dishCount:            r.restaurant._count.dishes,
        photoCount:           r.restaurant._count.photos,
        hasInternalNotes:     r.internalNotes !== null,
      })),
      total,
      page:  params.page,
      limit: params.limit,
    }
  },

  // ── getDetail ─────────────────────────────────────────────
  // Returns all data needed for the review screen.
  // Does NOT trigger soft assignment — that is the POST /assign responsibility.

  async getDetail(restaurantId: string) {
    const restaurant = await db.restaurant.findFirst({
      where:   { id: restaurantId },
      include: {
        verification: {
          include: {
            events: { orderBy: { createdAt: 'asc' } },
          },
        },
        dishes: {
          where:   { deletedAt: null },
          include: { dish: { select: { canonicalName: true, category: true } } },
          orderBy: { createdAt: 'asc' },
        },
        photos: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!restaurant)              throw new NotFoundError('Restaurant')
    if (!restaurant.verification) throw new NotFoundError('VerificationRecord')

    return restaurant
  },

  // ── getHistory ────────────────────────────────────────────
  // Returns the full append-only VerificationEvent log, oldest first.
  // No pagination — a restaurant accumulates at most a handful of events.

  async getHistory(restaurantId: string) {
    const record = await db.verificationRecord.findFirst({
      where:  { restaurantId },
      select: { id: true },
    })
    if (!record) throw new NotFoundError('VerificationRecord')

    return db.verificationEvent.findMany({
      where:   { restaurantId },
      orderBy: { createdAt: 'asc' },
    })
  },

} as const

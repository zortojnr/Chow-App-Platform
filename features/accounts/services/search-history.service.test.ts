// Search History Service — unit tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchHistoryService } from './search-history.service'

vi.mock('@/lib/db', () => ({
  db: {
    userSearchHistory: {
      findMany: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
const mockDb = db as any

const USER_ID = 'user-uuid-001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SearchHistoryService.listRecent', () => {
  it('deduplicates repeated queries case-insensitively, keeping the most recent', async () => {
    mockDb.userSearchHistory.findMany.mockResolvedValue([
      { query: 'Jollof Rice', location: 'Abuja', createdAt: new Date('2026-06-03') },
      { query: 'jollof rice', location: 'Abuja', createdAt: new Date('2026-06-01') },
      { query: 'Egusi Soup', location: null, createdAt: new Date('2026-06-02') },
    ])

    const result = await SearchHistoryService.listRecent(USER_ID)

    expect(result).toEqual([
      { query: 'Jollof Rice', location: 'Abuja', createdAt: '2026-06-03T00:00:00.000Z' },
      { query: 'Egusi Soup', location: null, createdAt: '2026-06-02T00:00:00.000Z' },
    ])
  })

  it('caps results at 10 entries', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      query: `Dish ${i}`,
      location: null,
      createdAt: new Date(2026, 5, i + 1),
    }))
    mockDb.userSearchHistory.findMany.mockResolvedValue(rows)

    const result = await SearchHistoryService.listRecent(USER_ID)

    expect(result).toHaveLength(10)
  })
})

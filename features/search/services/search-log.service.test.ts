// search-log.service.test.ts — Step 7
//
// Coverage:
//   ✓ SearchLog is created after log() is called
//   ✓ UserSearchHistory is created when userId provided
//   ✓ UserSearchHistory is NOT created when userId absent
//   ✓ query is trimmed before write
//   ✓ query capped at 200 chars before write
//   ✓ empty query after trim → nothing written
//   ✓ log() returns void immediately (fire-and-forget pattern confirmed)
//   ✓ DB failure does not propagate to caller
//   ✓ location field is used (not city)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchLogService } from './search-log.service'

vi.mock('@/lib/db', () => ({
  db: {
    searchLog: { create: vi.fn() },
    userSearchHistory: { create: vi.fn() },
  },
}))

import { db } from '@/lib/db'
const mockSearchLogCreate = vi.mocked(db.searchLog.create)
const mockHistoryCreate = vi.mocked(db.userSearchHistory.create)

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchLogCreate.mockResolvedValue({} as never)
  mockHistoryCreate.mockResolvedValue({} as never)
})

// ─── Helper: flush all micro-tasks so async fire-and-forget runs ─

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('SearchLogService.log', () => {
  // ─── Fire-and-forget pattern ──────────────────────────────

  it('returns void immediately (undefined)', () => {
    const result = SearchLogService.log({
      query: 'jollof rice',
      location: 'Lagos',
      resultCount: 4,
    })

    expect(result).toBeUndefined()
  })

  // ─── SearchLog written ────────────────────────────────────

  it('writes to SearchLog after call', async () => {
    SearchLogService.log({ query: 'jollof rice', location: 'Lagos', resultCount: 4 })
    await flush()

    expect(mockSearchLogCreate).toHaveBeenCalledOnce()
    expect(mockSearchLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          query: 'jollof rice',
          location: 'Lagos',
          resultCount: 4,
        }),
      }),
    )
  })

  it('uses location field name (not city)', async () => {
    SearchLogService.log({ query: 'suya', location: 'Abuja', resultCount: 2 })
    await flush()

    const callArg = mockSearchLogCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect('location' in callArg.data).toBe(true)
    expect('city' in callArg.data).toBe(false)
  })

  // ─── UserSearchHistory written only when userId set ───────

  it('writes UserSearchHistory when userId is provided', async () => {
    SearchLogService.log({
      query: 'egusi soup',
      location: 'Lagos',
      resultCount: 6,
      userId: 'user-1',
    })
    await flush()

    expect(mockHistoryCreate).toHaveBeenCalledOnce()
    expect(mockHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          query: 'egusi soup',
          location: 'Lagos',
        }),
      }),
    )
  })

  it('does NOT write UserSearchHistory when userId is absent', async () => {
    SearchLogService.log({ query: 'pounded yam', location: null, resultCount: 0 })
    await flush()

    expect(mockHistoryCreate).not.toHaveBeenCalled()
  })

  it('does NOT write UserSearchHistory when userId is null', async () => {
    SearchLogService.log({ query: 'pounded yam', location: null, resultCount: 0, userId: null })
    await flush()

    expect(mockHistoryCreate).not.toHaveBeenCalled()
  })

  // ─── query trimming ───────────────────────────────────────

  it('trims whitespace from query before write', async () => {
    SearchLogService.log({ query: '  jollof rice  ', location: null, resultCount: 1 })
    await flush()

    const callArg = mockSearchLogCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(callArg.data.query).toBe('jollof rice')
  })

  it('caps query at 200 chars', async () => {
    const longQuery = 'a'.repeat(250)
    SearchLogService.log({ query: longQuery, location: null, resultCount: 0 })
    await flush()

    const callArg = mockSearchLogCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect((callArg.data.query as string).length).toBe(200)
  })

  // ─── Empty query guard ────────────────────────────────────

  it('writes nothing when query is empty after trim', async () => {
    SearchLogService.log({ query: '   ', location: null, resultCount: 0 })
    await flush()

    expect(mockSearchLogCreate).not.toHaveBeenCalled()
    expect(mockHistoryCreate).not.toHaveBeenCalled()
  })

  // ─── DB failure does not propagate ───────────────────────

  it('does not throw when SearchLog write fails', async () => {
    mockSearchLogCreate.mockRejectedValueOnce(new Error('DB error'))

    // Should not throw — fire-and-forget swallows the error
    expect(() => {
      SearchLogService.log({ query: 'suya', location: null, resultCount: 2 })
    }).not.toThrow()

    await flush()
    // Error was swallowed — no uncaught rejection
  })

  it('does not throw when UserSearchHistory write fails', async () => {
    mockHistoryCreate.mockRejectedValueOnce(new Error('DB error'))

    expect(() => {
      SearchLogService.log({ query: 'suya', location: null, resultCount: 2, userId: 'user-1' })
    }).not.toThrow()

    await flush()
  })

  // ─── location nullable ────────────────────────────────────

  it('writes null location when none provided', async () => {
    SearchLogService.log({ query: 'akara', location: null, resultCount: 3 })
    await flush()

    const callArg = mockSearchLogCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(callArg.data.location).toBeNull()
  })
})

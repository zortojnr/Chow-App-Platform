// Search Log Service — Step 7
//
// Fire-and-forget logging for every search request.
// Two targets:
//   SearchLog       — always (anonymous + authenticated)
//   UserSearchHistory — when userId is provided (authenticated users only)
//
// Rules:
//   - NEVER awaited by the caller — the write is detached from the response.
//   - Failures are caught and logged to console; never propagated.
//   - query is trimmed and capped at 200 chars before write.
//   - Field name is `location`, not `city` — matches UserSearchHistory.location.
//
// Governed by: track-04-search-discovery.md §3.2, §8.1

import { db } from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────

export type SearchLogParams = {
  query: string
  location: string | null    // city name, e.g. "Lagos" — matches SearchLog.location
  resultCount: number
  userId?: string | null     // when set, also writes UserSearchHistory
}

// ─── Public API ───────────────────────────────────────────────

export const SearchLogService = {
  /**
   * Fire-and-forget log write. Always returns void immediately.
   * The caller must NOT await this function — doing so would add latency.
   *
   * Usage:
   *   SearchLogService.log(params)   // ← no await, no return value needed
   */
  log(params: SearchLogParams): void {
    writeLog(params).catch((err) => {
      console.error('[SearchLogService] log write failed:', err)
    })
  },
}

// ─── Internal write ───────────────────────────────────────────

async function writeLog(params: SearchLogParams): Promise<void> {
  const { query, location, resultCount, userId } = params
  const trimmed = query.trim().slice(0, 200)
  if (!trimmed) return

  const writes: Promise<unknown>[] = [
    db.searchLog.create({
      data: {
        query: trimmed,
        location: location ?? null,
        resultCount,
      },
    }),
  ]

  if (userId) {
    writes.push(
      db.userSearchHistory.create({
        data: {
          userId,
          query: trimmed,
          location: location ?? null,
        },
      }),
    )
  }

  await Promise.all(writes)
}

// Search History Read Service — Track 5 §7
//
// UserSearchHistory is already written by SearchLogService (track-04
// search-discovery §8.1). This service only reads it back for the search
// bar's idle-state dropdown.
//
// Governed by: track-05-user-accounts.md §7

import { db } from '@/lib/db'

export type SearchHistoryItem = {
  query: string
  location: string | null
  createdAt: string
}

const MAX_ENTRIES = 10

export const SearchHistoryService = {
  /**
   * Returns the user's last searches, most recent first, deduplicated by
   * query text (case-insensitive) so repeated searches for the same dish
   * don't crowd out variety in the dropdown.
   */
  async listRecent(userId: string): Promise<SearchHistoryItem[]> {
    const rows = await db.userSearchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_ENTRIES * 3, // over-fetch to allow for dedup below
      select: { query: true, location: true, createdAt: true },
    })

    const seen = new Set<string>()
    const deduped: SearchHistoryItem[] = []
    for (const row of rows) {
      const key = row.query.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push({ query: row.query, location: row.location, createdAt: row.createdAt.toISOString() })
      if (deduped.length === MAX_ENTRIES) break
    }
    return deduped
  },
}

'use client'

// useSearchHistory — reads GET /api/v1/users/search-history for authenticated
// users. Feeds the search bar's idle-state dropdown (track-05 §7).
//
// Governed by: track-05-user-accounts.md §7

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { SearchHistoryItem } from '../services/search-history.service'

async function fetchSearchHistory(): Promise<SearchHistoryItem[]> {
  try {
    const res = await fetch('/api/v1/users/search-history')
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json?.data?.items) ? json.data.items : []
  } catch {
    return []
  }
}

export function useSearchHistory() {
  const { status } = useSession()

  return useQuery({
    queryKey: ['search-history'],
    queryFn: fetchSearchHistory,
    enabled: status === 'authenticated',
    staleTime: 60_000,
    retry: false,
  })
}

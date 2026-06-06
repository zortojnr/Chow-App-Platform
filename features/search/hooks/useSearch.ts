'use client'

// useSearch — TanStack Query wrapper for /api/v1/search
// Keyed by [q, city, type, page]. Enabled only when q >= 2 chars.
//
// Governed by: track-04-search-discovery.md §15.2 Step 11

import { useQuery } from '@tanstack/react-query'
import type { SearchResponse } from '../types/search.types'

interface UseSearchParams {
  q: string
  city?: string | null
  type?: 'dishes' | 'restaurants' | 'all'
  page?: number
  enabled?: boolean
}

async function fetchSearch(params: UseSearchParams): Promise<SearchResponse> {
  const sp = new URLSearchParams()
  sp.set('q', params.q)
  if (params.city)                  sp.set('city', params.city)
  if (params.type && params.type !== 'all') sp.set('type', params.type)
  if (params.page && params.page > 1)       sp.set('page', String(params.page))

  const res = await fetch(`/api/v1/search?${sp}`)
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error('Search returned error')
  return json.data as SearchResponse
}

export function useSearch({
  q,
  city,
  type = 'all',
  page = 1,
  enabled = true,
}: UseSearchParams) {
  return useQuery({
    queryKey: ['search', q, city ?? null, type, page],
    queryFn:  () => fetchSearch({ q, city, type, page }),
    enabled:  enabled && q.trim().length >= 2,
    staleTime: 30_000,
    retry:    (failureCount, error) => {
      // Don't retry on 4xx
      if (error instanceof Error && error.message.includes('4')) return false
      return failureCount < 1
    },
  })
}

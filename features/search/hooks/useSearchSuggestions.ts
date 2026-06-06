'use client'

// useSearchSuggestions — debounced 150ms autocomplete hook
// Calls /api/v1/search/suggestions?q=... on input change.
// Returns empty array when q < 2 chars. Never shows error — silent degradation.
//
// Governed by: track-04-search-discovery.md §3.3, §10.3, Step 11

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { SuggestionResult } from '../types/search.types'

async function fetchSuggestions(q: string): Promise<SuggestionResult[]> {
  try {
    const res = await fetch(`/api/v1/search/suggestions?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.data) ? json.data : []
  } catch {
    return []
  }
}

export function useSearchSuggestions(input: string) {
  const [debouncedInput, setDebouncedInput] = useState(input)

  useEffect(() => {
    if (input.trim().length < 2) {
      setDebouncedInput('')
      return
    }
    const id = setTimeout(() => setDebouncedInput(input.trim()), 150)
    return () => clearTimeout(id)
  }, [input])

  return useQuery({
    queryKey: ['suggestions', debouncedInput],
    queryFn:  () => fetchSuggestions(debouncedInput),
    enabled:  debouncedInput.length >= 2,
    staleTime: 60_000,
    retry:    false,
  })
}

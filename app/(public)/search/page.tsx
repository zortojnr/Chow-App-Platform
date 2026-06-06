// /search — Step 15, §15.1
//
// Client-rendered, noindex. URL is source of truth for query state.
// Reads q, city, type, page from searchParams.
// Fetches results via useSearch (TanStack Query).
//
// Results layout: dish tiles section (if dish matches) + restaurant cards grid.
// Pagination: URL-based previous/next.
// Empty state: ZeroResults.
// Loading: 8 SearchRestaurantCard skeletons (0ms delay).
//
// Governed by: track-04-search-discovery.md §15.1, Step 15

import type { Metadata } from 'next'
import { SearchPageClient } from './SearchPageClient'

// §9.2: search page is never indexed
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

interface Props {
  searchParams: Promise<{
    q?:    string
    city?: string
    type?: string
    page?: string
  }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = '', city, type, page } = await searchParams
  return (
    <SearchPageClient
      initialQuery={q}
      initialCity={city}
      initialType={(type as 'dishes' | 'restaurants' | 'all') ?? 'all'}
      initialPage={parseInt(page ?? '1', 10) || 1}
    />
  )
}

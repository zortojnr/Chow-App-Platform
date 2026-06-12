'use client'

// SearchPageClient — the client-rendered body of /search.
// Reads query from props (passed by server SearchPage) and re-runs on URL changes.
// Uses useSearch (TanStack Query) for data fetching.
// Pagination updates URL with router.push.
//
// Governed by: track-04-search-discovery.md Step 15

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SearchBar } from 'features/search/components/SearchBar'
import { SearchResults } from 'features/search/components/SearchResults'
import { CategoryChips } from 'features/search/components/CategoryChips'
import { useSearch } from 'features/search/hooks/useSearch'
import { useSearchStore } from 'features/search/stores/search.store'
import { LocationPrompt } from 'features/location/components/LocationPrompt'
import { useLocationStore } from 'features/location/stores/location.store'
import { cn } from '@/lib/utils'

interface SearchPageClientProps {
  initialQuery: string
  initialCity?: string
  initialType:  'dishes' | 'restaurants' | 'all'
  initialPage:  number
}

export function SearchPageClient({
  initialQuery,
  initialCity,
  initialType,
  initialPage,
}: SearchPageClientProps) {
  const router = useRouter()
  const { cityContext, setCityContext } = useSearchStore()
  const { latitude: userLat, longitude: userLng } = useLocationStore()

  // Sync city from URL into store on first load
  useEffect(() => {
    if (initialCity && cityContext !== initialCity) {
      setCityContext(initialCity)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeCity = initialCity ?? cityContext

  const { data, isLoading, isError } = useSearch({
    q:       initialQuery,
    city:    activeCity,
    type:    initialType,
    page:    initialPage,
    enabled: initialQuery.trim().length >= 2,
    userLat: userLat ?? undefined,
    userLng: userLng ?? undefined,
  })

  const buildUrl = (page: number) => {
    const sp = new URLSearchParams({ q: initialQuery })
    if (activeCity)         sp.set('city', activeCity)
    if (initialType !== 'all') sp.set('type', initialType)
    if (page > 1)           sp.set('page', String(page))
    return `/search?${sp}`
  }

  const hasResults  = !!data && !data.isZeroResult
  const hasMore     = data?.hasMore ?? false
  const currentPage = initialPage

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Sticky search header ────────────────────────── */}
      <div className="sticky top-0 z-30 bg-neutral-0 border-b border-neutral-200">
        <div className="px-4 py-3 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <SearchBar
              defaultValue={initialQuery}
              onSearch={(q) => {
                const sp = new URLSearchParams({ q })
                if (activeCity) sp.set('city', activeCity)
                router.push(`/search?${sp}`)
              }}
            />
          </div>
        </div>
        <LocationPrompt />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">

        {/* ── Query context bar ──────────────────────────── */}
        {initialQuery && (
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="font-display text-xl md:text-2xl font-semibold text-neutral-900">
                {initialQuery}
              </h1>
              {activeCity && !isLoading && (
                <p className="text-sm text-neutral-500 mt-0.5">
                  Results in <span className="font-medium text-neutral-700">{activeCity}</span>
                  {hasResults && data && (
                    <span className="text-neutral-400"> · {data.total} restaurant{data.total === 1 ? '' : 's'}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── No query: show category chips ─────────────── */}
        {!initialQuery && (
          <div className="mb-8">
            <CategoryChips />
          </div>
        )}

        {/* ── Results ────────────────────────────────────── */}
        <SearchResults
          response={data}
          query={initialQuery}
          city={activeCity}
          isLoading={isLoading && initialQuery.trim().length >= 2}
          isError={isError}
        />

        {/* ── Pagination ─────────────────────────────────── */}
        {hasResults && (hasMore || currentPage > 1) && (
          <nav
            aria-label="Page navigation"
            className="flex items-center justify-center gap-4 mt-10"
          >
            {currentPage > 1 ? (
              <a
                href={buildUrl(currentPage - 1)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-300" aria-disabled="true">
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </span>
            )}

            <span className="text-sm text-neutral-500">Page {currentPage}</span>

            {hasMore ? (
              <a
                href={buildUrl(currentPage + 1)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
                aria-label="Next page"
              >
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-300" aria-disabled="true">
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}

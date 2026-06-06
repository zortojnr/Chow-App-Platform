'use client'

// ZeroResults — Step 14, §15.5.2, DS §15.2
//
// Empty state for zero search results.
// Specific: names the query. Actionable: two CTAs. Honest: not an error. Warm: natural copy.
//
// DS §15.2 per-context spec:
//   Headline: "No results for "[query]""
//   Body:     "We haven't verified a restaurant serving this dish in [city] yet."
//   CTA:      "Submit a restaurant" + "Search all cities"
//
// Also handles: timed-out searches (timeoutFlag), no-city state.

import Link from 'next/link'
import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ZeroResultsProps {
  query:       string
  city?:       string | null
  timeoutFlag?: boolean
  className?:  string
}

export function ZeroResults({ query, city, timeoutFlag, className }: ZeroResultsProps) {
  const headline = timeoutFlag
    ? 'Search timed out'
    : `No results for "${query}"`

  const body = timeoutFlag
    ? 'Search is temporarily unavailable. Please try again.'
    : city
      ? `We haven't verified a restaurant serving this dish in ${city} yet.`
      : `No verified restaurants serve this dish yet.`

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        // Same min-height as 4 card rows to avoid layout shift (§11.4)
        'min-h-[400px]',
        className,
      )}
      role="status"
      aria-label={headline}
    >
      {/* Illustration — line-art style bowl, DS §15.3 */}
      <div
        className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-6"
        aria-hidden="true"
      >
        <UtensilsCrossed size={32} strokeWidth={1.5} className="text-amber-500" />
      </div>

      {/* Headline — Fraunces, text-2xl, §15.1 */}
      <h2 className="font-display text-2xl font-semibold text-neutral-800 mb-2">
        {headline}
      </h2>

      {/* Body copy */}
      <p className="text-base text-neutral-600 max-w-sm mb-6">
        {body}
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/submit"
          className={cn(
            'inline-flex items-center justify-center h-11 px-6 rounded-[10px]',
            'bg-amber-500 text-neutral-0 text-base font-semibold',
            'transition-colors duration-fast hover:bg-amber-600',
            'focus-visible:outline-none focus-visible:shadow-brand',
          )}
        >
          Submit a restaurant
        </Link>

        {city && (
          <Link
            href={`/search?q=${encodeURIComponent(query)}`}
            className={cn(
              'inline-flex items-center justify-center h-11 px-6 rounded-[10px]',
              'bg-neutral-0 text-neutral-700 text-base font-semibold',
              'border border-neutral-300 hover:bg-neutral-50',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:shadow-brand',
            )}
          >
            Search all cities
          </Link>
        )}
      </div>
    </div>
  )
}

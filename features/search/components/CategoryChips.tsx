'use client'

// CategoryChips — §4.1 Section 2, §15.5.5
//
// Horizontal scrollable row of 9 dish category chips.
// Mobile: scroll-snap-type x mandatory, no visible scrollbar.
// Tablet+: wrap to a flex row.
//
// Each chip navigates to /category/[slug].
// No active state on home page — all chips are equal entry points.
// An active slug prop highlights the current category (for category browse pages).
//
// Accessibility: standard <a> links with descriptive labels.
// Touch targets: 44px minimum height (DS §8.5).

import Link from 'next/link'
import { CATEGORY_CHIPS } from '../types/search.types'
import { cn } from '@/lib/utils'

interface CategoryChipsProps {
  activeSlug?: string
  className?:  string
}

export function CategoryChips({ activeSlug, className }: CategoryChipsProps) {
  return (
    <div
      role="navigation"
      aria-label="Browse by food category"
      className={cn('w-full', className)}
    >
      <p className="text-center text-xs font-medium text-neutral-500 uppercase tracking-[0.08em] mb-3 px-4 md:px-0">
        What are you in the mood for?
      </p>

      {/* Horizontal scroll on mobile, flex-wrap on tablet+ */}
      <div className="flex justify-center gap-2 overflow-x-auto scrollbar-none px-4 md:px-0 md:flex-wrap scroll-snap-x-mandatory">
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = activeSlug === chip.slug
          return (
            <Link
              key={chip.slug}
              href={`/category/${chip.slug}`}
              className={cn(
                // Touch target: min 44px height (DS §8.5)
                'shrink-0 inline-flex items-center rounded-full px-4 py-2.5',
                'text-sm font-medium transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:shadow-brand',
                'scroll-snap-align-start',
                isActive
                  ? 'bg-amber-500 text-neutral-0'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {chip.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

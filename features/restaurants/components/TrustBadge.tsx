'use client'

// TrustBadge — design-system-v1.md §6.1, §6.2, §7.2, §10.4
//
// The primary consumer trust signal on every approved listing. Two parts:
//   1. Green verified pill  — always shown (§6.2: green-500 bg, neutral-0 text)
//   2. Score band label     — profile page only (§7.3: text-sm, green-700 below pill)
//
// Score band consumer labels (§7.2):
//   EXCELLENT (0.90–1.00) → "Excellent"
//   STRONG    (0.70–0.89) → "Strong"
//   VERIFIED  (0.40–0.69) → "Verified"   ← "Verified" used for both bands so the
//                                            consumer never sees a degraded label on
//                                            an admin-approved listing.
//
// Raw score is NEVER shown. Consumer sees "Strong", not "0.75".
// Text is always "Verified" — never "Approved" (§13.4 consumer copy standard).
//
// Skeleton: same pill dimensions, neutral-200 background.
//
// Accessibility: role="status" on the pill. aria-label describes the full meaning.

import { ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type ScoreBand = 'EXCELLENT' | 'STRONG' | 'VERIFIED'

const BAND_LABELS: Record<ScoreBand, string> = {
  EXCELLENT: 'Excellent',
  STRONG:    'Strong',
  VERIFIED:  'Verified',
}

interface TrustBadgeProps {
  scoreBand:  ScoreBand
  showBand?:  boolean            // true on profile page; false on browse cards
  size?:      'sm' | 'md'       // sm = cards; md = profile hero overlay
  className?: string
}

export function TrustBadge({
  scoreBand,
  showBand  = false,
  size      = 'sm',
  className,
}: TrustBadgeProps) {
  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      {/* Verified pill — green-500 bg, neutral-0 text per §6.2 */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-semibold select-none',
          'bg-green-500 text-neutral-0',
          size === 'sm'
            ? 'px-2.5 py-[5px] text-xs'
            : 'px-3.5 py-2 text-sm',
        )}
        role="status"
        aria-label="Verified restaurant — reviewed and approved by Chow Here"
      >
        <ShieldCheck
          size={size === 'sm' ? 12 : 14}
          strokeWidth={1.5}
          aria-hidden="true"
        />
        Verified
      </span>

      {/* Score band label — profile page only, text-sm green-700 per §7.3 */}
      {showBand && (
        <span
          className="text-sm font-medium text-green-700 pl-0.5"
          aria-label={`Trust level: ${BAND_LABELS[scoreBand]}`}
        >
          {BAND_LABELS[scoreBand]}
        </span>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────

interface TrustBadgeSkeletonProps {
  showBand?: boolean
}

export function TrustBadgeSkeleton({ showBand = false }: TrustBadgeSkeletonProps) {
  return (
    <div className="inline-flex flex-col items-start gap-1" aria-hidden="true">
      <Skeleton className="h-[26px] w-[86px] rounded-full" />
      {showBand && <Skeleton className="h-4 w-14 rounded" />}
    </div>
  )
}

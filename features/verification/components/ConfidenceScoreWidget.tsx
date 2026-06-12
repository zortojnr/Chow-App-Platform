// ConfidenceScoreWidget — DS §10.3 Confidence Score Widget spec.
// Score number: JetBrains Mono, text-5xl, bold. Color thresholds: §10.3.
// 7 signal rows: earned = green-50 bg + check; missing = neutral bg + dash.
// Handles override state: amber banner + lastComputedBreakdown shown.
// Shared between Step 18 (review) and Step 19 (intelligence).

import { Check, Minus, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ScoreBreakdown, StandardBreakdown, OverrideBreakdown } from 'features/admin/components/review/review.types'

// ─── Re-export for consumers ───────────────────────────────────
export type { ScoreBreakdown, StandardBreakdown, OverrideBreakdown }

// ─── Utilities ────────────────────────────────────────────────

function scoreColorClass(score: number): string {
  if (score < 0.40) return 'text-status-error'
  if (score < 0.70) return 'text-status-warning'
  return 'text-green-500'
}

function scoreBand(score: number): string {
  if (score < 0.25) return 'Incomplete'
  if (score < 0.50) return 'Marginal'
  if (score < 0.70) return 'Acceptable'
  if (score < 0.90) return 'Strong'
  return 'Excellent'
}

function formatAge(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TRIGGER_LABELS: Record<string, string> = {
  STATUS_TRANSITION: 'Status change',
  PHOTO_VERIFIED:    'Photo verified',
  DISH_ADDED:        'Dish added',
  DISH_REMOVED:      'Dish removed',
  FIELD_UPDATED:     'Field updated',
}

// ─── Signal row config ─────────────────────────────────────────

const SIGNALS = [
  { key: 'S1_phoneValid',      label: 'Valid phone number',          weight: 0.20 },
  { key: 'S2_verifiedPhoto',   label: 'At least 1 verified photo',   weight: 0.15 },
  { key: 'S3_threeDishes',     label: '3 or more dishes linked',     weight: 0.15 },
  { key: 'S4_adminApproved',   label: 'Admin approved',              weight: 0.25 },
  { key: 'S5_description',     label: 'Description ≥ 50 characters', weight: 0.10 },
  { key: 'S6_detailedAddress', label: 'Street-level address',        weight: 0.10 },
  { key: 'S7_contactChannel',  label: 'Website or email present',    weight: 0.05 },
] as const

// ─── Component ────────────────────────────────────────────────

type Props = {
  score:       number
  breakdown:   ScoreBreakdown
  onOverride?: () => void   // undefined = hide override button (non-SUPER)
}

export function ConfidenceScoreWidget({ score, breakdown, onOverride }: Props) {
  const pct        = Math.round(score * 100)
  const isOverride = breakdown.overridden === true

  const signals: Record<string, number> = isOverride
    ? (breakdown as OverrideBreakdown).lastComputedBreakdown as Record<string, number>
    : breakdown as unknown as Record<string, number>

  return (
    <div
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden"
      aria-label="Confidence score breakdown"
    >

      {/* Override banner — shown only when score was manually overridden */}
      {isOverride && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40">
          <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Score manually overridden</span> on{' '}
            {new Date((breakdown as OverrideBreakdown).overriddenAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}.
            {' '}Next data change will revert to computed score.
          </p>
        </div>
      )}

      {/* Score header */}
      <div className="px-4 py-4 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <span
            className={cn('font-mono text-5xl font-bold leading-none tabular-nums', scoreColorClass(score))}
            aria-label={`Confidence score: ${pct}%`}
          >
            {pct}%
          </span>
          <span className={cn('text-sm font-medium', scoreColorClass(score))}>
            {scoreBand(score)}
          </span>
        </div>
        {onOverride && (
          <button
            type="button"
            onClick={onOverride}
            className={cn(
              'text-xs text-[var(--admin-text-tertiary)] hover:text-amber-600',
              'transition-colors duration-[100ms] ease-out',
              'focus-visible:outline-none focus-visible:shadow-brand rounded px-1',
            )}
          >
            Override
          </button>
        )}
      </div>

      {/* Signal rows */}
      <div className="border-t border-[var(--admin-border)]" role="list" aria-label="Score signal breakdown">
        {SIGNALS.map(({ key, label, weight }) => {
          const earned = (signals[key] ?? 0) > 0
          return (
            <div
              key={key}
              role="listitem"
              className={cn(
                'flex items-center gap-3 px-4 py-2',
                'border-b border-[var(--admin-border)] last:border-0',
                earned ? 'bg-green-50' : 'bg-[var(--admin-bg-surface)]',
              )}
              aria-label={`${label}: ${earned ? 'earned' : 'not earned'}`}
            >
              {earned ? (
                <Check size={14} strokeWidth={2} className="shrink-0 text-green-500" aria-hidden="true" />
              ) : (
                <Minus size={14} strokeWidth={1.5} className="shrink-0 text-neutral-300" aria-hidden="true" />
              )}
              <span className={cn(
                'text-sm flex-1',
                earned ? 'text-[var(--admin-text-primary)]' : 'text-[var(--admin-text-secondary)]',
              )}>
                {label}
              </span>
              <span className={cn(
                'font-mono text-xs tabular-nums',
                earned ? 'text-green-600' : 'text-neutral-400',
              )}>
                {earned
                  ? `+${(weight * 100).toFixed(0)}`
                  : `${(weight * 100).toFixed(0)}`
                }
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer: recalculation meta */}
      {!isOverride && (breakdown as StandardBreakdown).calculatedAt && (
        <div className="px-4 py-2.5 border-t border-[var(--admin-border)] flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--admin-text-tertiary)]">
            Recalculated {formatAge((breakdown as StandardBreakdown).calculatedAt)}
          </span>
          {(breakdown as StandardBreakdown).trigger && (
            <span className="text-xs text-[var(--admin-text-tertiary)]">
              {TRIGGER_LABELS[(breakdown as StandardBreakdown).trigger] ?? (breakdown as StandardBreakdown).trigger}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────

export function ConfidenceScoreWidgetSkeleton() {
  return (
    <div
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden"
      aria-busy="true"
      aria-label="Loading confidence score"
    >
      <div className="px-4 py-4">
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="border-t border-[var(--admin-border)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-2 border-b border-[var(--admin-border)] last:border-0"
            aria-hidden="true"
          >
            <Skeleton className="h-3.5 w-3.5 rounded-full" static />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-5" static />
          </div>
        ))}
      </div>
    </div>
  )
}

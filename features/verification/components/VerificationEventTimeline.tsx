// VerificationEventTimeline — append-only audit trail for the review screen.
// DS §15.2: empty state — clock icon, "No history yet".
// DS §16.3: 4 event row skeletons with stagger.
// Score override events: fromStatus === toStatus — shown with amber accent.
// Timestamps: relative on display; absolute ISO on hover tooltip.

import { Clock, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { VerificationStatusBadge } from 'features/verification/components/VerificationStatusBadge'
import type { VerificationStatusValue } from 'features/verification/components/VerificationStatusBadge'
import { cn } from '@/lib/utils'
import type { ReviewEvent } from 'features/admin/components/review/review.types'

// ─── Helpers ──────────────────────────────────────────────────

function formatAge(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)   return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function actorLabel(actorId: string, actorRole: string): string {
  if (actorId === 'SYSTEM') return 'System'
  return actorRole === 'SUPER' ? 'Super admin' : 'Admin'
}

// Score override events have fromStatus === toStatus (per confidence-scoring-spec.md §7.3)
function isOverrideEvent(event: ReviewEvent): boolean {
  return event.fromStatus !== null &&
    event.fromStatus === event.toStatus &&
    (event.reason?.startsWith('SCORE_OVERRIDE:') ?? false)
}

// ─── Single event row ──────────────────────────────────────────

function EventRow({ event, index }: { event: ReviewEvent; index: number }) {
  const override = isOverrideEvent(event)

  return (
    <div
      className={cn(
        'flex gap-3 pb-4 last:pb-0',
        override && 'pl-3 border-l-2 border-amber-400 ml-1',
      )}
      style={{
        animationName:           'rowFadeIn',
        animationDuration:       '200ms',
        animationDelay:          `${Math.min(index, 5) * 40}ms`,
        animationFillMode:       'both',
        animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
      }}
    >
      {/* Timeline dot */}
      {!override && (
        <div className="flex flex-col items-center pt-1 shrink-0">
          <div className="w-2 h-2 rounded-full bg-neutral-300 shrink-0" />
          <div className="w-px flex-1 bg-neutral-200 mt-1.5" />
        </div>
      )}

      {/* Event body */}
      <div className={cn('flex-1 min-w-0', !override && 'pl-1')}>

        {/* Status transition pair */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {override ? (
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Score override
            </span>
          ) : event.fromStatus ? (
            <>
              <VerificationStatusBadge
                status={event.fromStatus as VerificationStatusValue}
                className="text-xs"
              />
              <ArrowRight size={12} strokeWidth={1.5} className="text-neutral-400 shrink-0" aria-hidden="true" />
              <VerificationStatusBadge
                status={event.toStatus as VerificationStatusValue}
                className="text-xs"
              />
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-neutral-100 text-neutral-400 select-none">
                Initial
              </span>
              <ArrowRight size={12} strokeWidth={1.5} className="text-neutral-400 shrink-0" aria-hidden="true" />
              <VerificationStatusBadge
                status={event.toStatus as VerificationStatusValue}
                className="text-xs"
              />
            </>
          )}
        </div>

        {/* Actor + timestamp */}
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--admin-text-secondary)]">
            {actorLabel(event.actorId, event.actorRole)}
          </span>
          <span className="text-neutral-300" aria-hidden="true">·</span>
          <time
            dateTime={event.createdAt}
            title={formatAbsolute(event.createdAt)}
            className="text-xs text-[var(--admin-text-tertiary)]"
          >
            {formatAge(event.createdAt)}
          </time>
        </div>

        {/* Reason or override note */}
        {event.reason && (
          <p className={cn(
            'mt-1.5 text-xs text-[var(--admin-text-secondary)] leading-relaxed',
            override && 'italic',
          )}>
            {override
              ? event.reason.replace('SCORE_OVERRIDE: ', '').split('Score:')[0].trim()
              : event.reason
            }
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────

type Props = {
  events: ReviewEvent[]
}

export function VerificationEventTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <Clock size={32} strokeWidth={1.5} className="text-neutral-300" aria-hidden="true" />
        <p className="text-2xl font-semibold text-neutral-800 font-sans">No history yet</p>
        <p className="text-base text-neutral-600">Status changes will appear here.</p>
      </div>
    )
  }

  return (
    <div role="list" aria-label="Verification history">
      {events.map((event, i) => (
        <div key={event.id} role="listitem">
          <EventRow event={event} index={i} />
        </div>
      ))}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────

export function VerificationEventTimelineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading verification history">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 pb-4 last:pb-0"
          aria-hidden="true"
          style={{
            animationName:     'rowFadeIn',
            animationDuration: '200ms',
            animationDelay:    `${i * 40}ms`,
            animationFillMode: 'both',
          }}
        >
          <div className="flex flex-col items-center pt-1 shrink-0">
            <Skeleton className="w-2 h-2 rounded-full" static />
            <div className="w-px flex-1 bg-neutral-200 mt-1.5" />
          </div>
          <div className="flex-1 pl-1 space-y-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-3 w-3" static />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

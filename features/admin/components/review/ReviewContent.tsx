// ReviewContent — main client component for the admin review screen.
// Fetches GET /api/v1/admin/verification/[restaurantId] and orchestrates all sections.
// Fires POST /assign on mount (fire-and-forget soft assignment). DS §11.4.
// DS §11.1–11.3 (admin density), §16 (loading), §15 (empty), §17 (error), §18 (dark mode).
// Two-column layout at lg+: restaurant details (left) + score + notes (right).

'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet, apiPost } from '@/lib/api'
import { VerificationStatusBadge } from 'features/verification/components/VerificationStatusBadge'
import { ConfidenceScoreWidget, ConfidenceScoreWidgetSkeleton } from 'features/verification/components/ConfidenceScoreWidget'
import { DishVerifyCard, DishVerifyCardSkeleton } from 'features/verification/components/DishVerifyCard'
import { PhotoVerifyGrid, PhotoVerifyGridSkeleton } from 'features/verification/components/PhotoVerifyGrid'
import { VerificationEventTimeline, VerificationEventTimelineSkeleton } from 'features/verification/components/VerificationEventTimeline'
import { RestaurantDetailPanel } from './RestaurantDetailPanel'
import { DuplicateWarningBanner } from './DuplicateWarningBanner'
import { InternalNotesPanel } from './InternalNotesPanel'
import { ActionBar } from './ActionBar'
import { OverrideScoreModal } from './modals/OverrideScoreModal'
import { cn } from '@/lib/utils'
import type { ReviewDetail } from './review.types'

// ─── Helpers ──────────────────────────────────────────────────

function formatAge(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60)  return `${Math.floor(ms / 86_400_000)}d ago`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)   return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

// ─── Section wrapper ───────────────────────────────────────────

function Section({
  title,
  children,
  index = 0,
}: {
  title: string
  children: React.ReactNode
  index?: number
}) {
  return (
    <section
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden"
      style={{
        animationName:           'rowFadeIn',
        animationDuration:       '200ms',
        animationDelay:          `${Math.min(index, 5) * 40}ms`,
        animationFillMode:       'both',
        animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
      }}
    >
      <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-b border-[var(--admin-border)]">
        <h2 className="text-xs font-semibold text-[var(--admin-text-tertiary)] uppercase tracking-wide">
          {title}
        </h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  )
}

// ─── Page skeleton ─────────────────────────────────────────────

function ReviewPageSkeleton() {
  return (
    <div className="p-6 space-y-6 pb-24" aria-busy="true">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[var(--admin-border)] p-4 space-y-3">
              <Skeleton className="h-3 w-20" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-4" style={{ width: `${60 + j * 15}%` }} />
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-4" aria-hidden="true">
          <ConfidenceScoreWidgetSkeleton />
          <div className="rounded-lg border border-[var(--admin-border)] p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>

      {/* Dishes */}
      <div className="rounded-lg border border-[var(--admin-border)] overflow-hidden" aria-hidden="true">
        <div className="px-4 py-3 bg-[var(--admin-bg-subtle)]"><Skeleton className="h-3 w-16" /></div>
        <div>
          {Array.from({ length: 3 }).map((_, i) => <DishVerifyCardSkeleton key={i} />)}
        </div>
      </div>

      {/* Photos */}
      <div className="rounded-lg border border-[var(--admin-border)] overflow-hidden" aria-hidden="true">
        <div className="px-4 py-3 bg-[var(--admin-bg-subtle)]"><Skeleton className="h-3 w-16" /></div>
        <div className="p-4"><PhotoVerifyGridSkeleton /></div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-[var(--admin-border)] overflow-hidden" aria-hidden="true">
        <div className="px-4 py-3 bg-[var(--admin-bg-subtle)]"><Skeleton className="h-3 w-24" /></div>
        <div className="p-4"><VerificationEventTimelineSkeleton /></div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

type Props = { restaurantId: string }

export function ReviewContent({ restaurantId }: Props) {
  const { data: session } = useSession()
  const router            = useRouter()
  const [overrideOpen, setOverrideOpen] = useState(false)

  const queryKey = ['admin', 'review', restaurantId] as const

  // Primary data fetch
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn:         () => apiGet<ReviewDetail>(`/api/v1/admin/verification/${restaurantId}`),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
    retry:           1,
  })

  // Fire-and-forget soft assignment on mount
  const { mutate: assign } = useMutation({
    mutationFn: () => apiPost(
      `/api/v1/admin/verification/${restaurantId}/assign`,
      { adminId: session?.user?.id ?? null },
    ),
  })

  useEffect(() => {
    if (session?.user?.id) {
      assign()
    }
  // Only fire once on mount when session is available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  // ── Loading ──────────────────────────────────────────────

  if (isLoading) return <ReviewPageSkeleton />

  // ── Error ────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="p-6">
        <div
          className="flex items-start gap-3 rounded-lg border border-status-error bg-status-error-bg px-4 py-3"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle
            size={16}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-status-error"
            aria-hidden="true"
          />
          <div className="text-sm">
            <span className="font-semibold text-neutral-900">Failed to load review. </span>
            <span className="text-neutral-600">
              {error instanceof Error ? error.message : 'An unexpected error occurred.'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const restaurant    = data
  const verification  = data.verification
  const score         = Number(data.confidenceScore)
  const isSuperAdmin  = session?.user?.role === 'SUPER'

  return (
    <div className="flex flex-col min-h-screen bg-[var(--admin-bg-page)]">

      {/* Scrollable content area — leave space for sticky action bar */}
      <div className="flex-1 p-6 space-y-6 pb-28">

        {/* Page header */}
        <div
          className="flex items-start gap-4 flex-wrap"
          style={{
            animationName:           'rowFadeIn',
            animationDuration:       '200ms',
            animationFillMode:       'both',
            animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
          }}
        >
          <Link
            href="/admin/queue"
            className={cn(
              'inline-flex items-center gap-1.5 mt-1 text-sm text-[var(--admin-text-secondary)]',
              'hover:text-[var(--admin-text-primary)] transition-colors duration-[100ms]',
              'focus-visible:outline-none focus-visible:shadow-brand rounded',
            )}
            aria-label="Back to verification queue"
          >
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
            Queue
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--admin-text-primary)] font-sans leading-tight truncate">
              {restaurant.name}
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
              {restaurant.city}, {restaurant.state}
              {' · '}Submitted {formatAge(restaurant.createdAt)}
              {verification.assignedTo && (
                <span className="ml-2 text-amber-600">· Assigned</span>
              )}
            </p>
          </div>

          <VerificationStatusBadge
            status={verification.currentStatus}
            dynamic
          />
        </div>

        {/* Duplicate warning — conditional */}
        <DuplicateWarningBanner internalNotes={verification.internalNotes} />

        {/* Two-column upper section */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6"
          style={{
            animationName:           'rowFadeIn',
            animationDuration:       '200ms',
            animationDelay:          '40ms',
            animationFillMode:       'both',
            animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
          }}
        >
          {/* Left: restaurant details */}
          <RestaurantDetailPanel restaurant={restaurant} />

          {/* Right: score widget + internal notes */}
          <div className="space-y-4">
            <ConfidenceScoreWidget
              score={score}
              breakdown={verification.scoreBreakdown}
              onOverride={isSuperAdmin ? () => setOverrideOpen(true) : undefined}
            />
            <InternalNotesPanel notes={verification.internalNotes} />
          </div>
        </div>

        {/* Dishes section */}
        <section
          className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden"
          style={{
            animationName:           'rowFadeIn',
            animationDuration:       '200ms',
            animationDelay:          '80ms',
            animationFillMode:       'both',
            animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
          }}
        >
          <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-b border-[var(--admin-border)] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--admin-text-tertiary)] uppercase tracking-wide">
              Dishes
            </h2>
            <span className="text-xs text-[var(--admin-text-tertiary)] font-mono">
              {restaurant.dishes.length} linked
              {' · '}
              {restaurant.dishes.filter(d => d.verifiedAt !== null).length} verified
            </span>
          </div>

          {restaurant.dishes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-300"
                aria-hidden="true"
              >
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
              <p className="text-2xl font-semibold text-neutral-800 font-sans">No dishes listed yet</p>
              <p className="text-base text-neutral-600">
                Dishes will appear here after the submitter adds them.
              </p>
            </div>
          ) : (
            <div>
              {restaurant.dishes.map((dish) => (
                <DishVerifyCard
                  key={dish.id}
                  dish={dish}
                  restaurantId={restaurantId}
                  queryKey={[...queryKey]}
                />
              ))}
            </div>
          )}
        </section>

        {/* Photos section */}
        <Section title="Photos" index={3}>
          <PhotoVerifyGrid
            photos={restaurant.photos}
            restaurantId={restaurantId}
            queryKey={[...queryKey]}
          />
        </Section>

        {/* Verification history */}
        <Section title="Verification History" index={4}>
          <VerificationEventTimeline events={verification.events} />
        </Section>

      </div>

      {/* Sticky action bar */}
      <ActionBar
        restaurantId={restaurantId}
        restaurantName={restaurant.name}
        status={verification.currentStatus}
        confidenceScore={score}
        internalNotes={verification.internalNotes}
        isSuperAdmin={isSuperAdmin}
        queryKey={[...queryKey]}
      />

      {/* SUPER-only score override modal — triggered from ConfidenceScoreWidget */}
      {isSuperAdmin && (
        <OverrideScoreModal
          open={overrideOpen}
          onClose={() => setOverrideOpen(false)}
          restaurantId={restaurantId}
          currentScore={score}
          queryKey={[...queryKey]}
        />
      )}

    </div>
  )
}

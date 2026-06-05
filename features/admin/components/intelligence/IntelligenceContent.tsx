// IntelligenceContent — main client component for the admin intelligence screen.
//
// Fetches GET /api/v1/admin/verification/:restaurantId (same endpoint as review screen).
// Orchestrates: restaurant fields (editable), dish list, photo grid, score widget, notes.
//
// Distinct from ReviewContent: no ActionBar, no EventTimeline, no DuplicateWarningBanner.
// Track-02 §10.2: "review is a one-time gatekeeping action; intelligence editing is
// ongoing maintenance."
//
// UD-C: accessible for any verification status (C1).
// DS §11.1–11.3, §16, §15, §17, §18 dark mode.

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/lib/api'
import { VerificationStatusBadge } from 'features/verification/components/VerificationStatusBadge'
import {
  ConfidenceScoreWidget,
  ConfidenceScoreWidgetSkeleton,
} from 'features/verification/components/ConfidenceScoreWidget'
import {
  PhotoVerifyGrid,
  PhotoVerifyGridSkeleton,
} from 'features/verification/components/PhotoVerifyGrid'
import { InternalNotesPanel } from 'features/admin/components/review/InternalNotesPanel'
import { OverrideScoreModal } from 'features/admin/components/review/modals/OverrideScoreModal'
import { RestaurantIntelligenceForm } from './RestaurantIntelligenceForm'
import { DishIntelligenceCard, DishIntelligenceCardSkeleton } from './DishIntelligenceCard'
import { cn } from '@/lib/utils'
import type { ReviewDetail } from 'features/admin/components/review/review.types'

// ─── Helpers ──────────────────────────────────────────────────

function formatAge(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime()
  const h   = Math.floor(ms / 3_600_000)
  if (h < 1)   return `${Math.floor(ms / 60_000)}m ago`
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

// ─── Section wrapper ───────────────────────────────────────────

function Section({
  title,
  children,
  headerRight,
  index = 0,
}: {
  title:        string
  children:     React.ReactNode
  headerRight?: React.ReactNode
  index?:       number
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
      <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-b border-[var(--admin-border)] flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[var(--admin-text-tertiary)] uppercase tracking-wide">
          {title}
        </h2>
        {headerRight}
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  )
}

// ─── Page skeleton ─────────────────────────────────────────────

function IntelligencePageSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-busy="true">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-4 w-24 mt-1" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex flex-col items-end gap-1.5" aria-hidden="true">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4" aria-hidden="true">
          {/* Restaurant fields */}
          <div className="rounded-lg border border-[var(--admin-border)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--admin-bg-subtle)]">
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="px-4 py-2 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-2 border-b border-[var(--admin-border)] last:border-0 space-y-1">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
          {/* Dishes */}
          <div className="rounded-lg border border-[var(--admin-border)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--admin-bg-subtle)]">
              <Skeleton className="h-3 w-14" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => <DishIntelligenceCardSkeleton key={i} />)}
          </div>
          {/* Photos */}
          <div className="rounded-lg border border-[var(--admin-border)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--admin-bg-subtle)]">
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="p-4"><PhotoVerifyGridSkeleton /></div>
          </div>
        </div>
        <div className="space-y-4" aria-hidden="true">
          <ConfidenceScoreWidgetSkeleton />
          <div className="rounded-lg border border-[var(--admin-border)] p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

type Props = { restaurantId: string }

export function IntelligenceContent({ restaurantId }: Props) {
  const { data: session }                 = useSession()
  const [overrideOpen, setOverrideOpen]   = useState(false)

  const queryKey = ['admin', 'intelligence', restaurantId] as const

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn:         () => apiGet<ReviewDetail>(`/api/v1/admin/verification/${restaurantId}`),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
    retry:           1,
  })

  if (isLoading) return <IntelligencePageSkeleton />

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
            <span className="font-semibold text-neutral-900">Failed to load intelligence data. </span>
            <span className="text-neutral-600">
              {error instanceof Error ? error.message : 'An unexpected error occurred.'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const restaurant   = data
  const verification = data.verification
  const score        = Number(data.confidenceScore)
  const isSuperAdmin = session?.user?.role === 'SUPER'

  return (
    <div className="flex flex-col min-h-screen bg-[var(--admin-bg-page)]">
      <div className="flex-1 p-6 space-y-6">

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
            href={`/admin/restaurants/${restaurantId}/review`}
            className={cn(
              'inline-flex items-center gap-1.5 mt-1 text-sm text-[var(--admin-text-secondary)]',
              'hover:text-[var(--admin-text-primary)] transition-colors duration-[100ms]',
              'focus-visible:outline-none focus-visible:shadow-brand rounded',
            )}
            aria-label={`Back to review screen for ${restaurant.name}`}
          >
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
            Review
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--admin-text-primary)] font-sans leading-tight truncate">
              {restaurant.name}
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
              {restaurant.city}, {restaurant.state}
              {' · '}Intelligence · Updated {formatAge(restaurant.createdAt)}
            </p>
          </div>

          <VerificationStatusBadge
            status={verification.currentStatus}
            dynamic
          />
        </div>

        {/* Two-column section */}
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
          {/* Left: restaurant details form */}
          <div
            style={{
              animationName:           'rowFadeIn',
              animationDuration:       '200ms',
              animationDelay:          '40ms',
              animationFillMode:       'both',
              animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
            }}
          >
            <RestaurantIntelligenceForm
              restaurant={restaurant}
              restaurantId={restaurantId}
              queryKey={[...queryKey]}
            />
          </div>

          {/* Right: score widget + notes */}
          <div
            className="space-y-4"
            style={{
              animationName:           'rowFadeIn',
              animationDuration:       '200ms',
              animationDelay:          '40ms',
              animationFillMode:       'both',
              animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
            }}
          >
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
              {restaurant.dishes.filter((d) => d.verifiedAt !== null).length} verified
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
                Dishes will appear here after the submitter adds them or an admin links them.
              </p>
            </div>
          ) : (
            <div>
              {restaurant.dishes.map((dish) => (
                <DishIntelligenceCard
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

      </div>

      {/* SUPER-only score override modal */}
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

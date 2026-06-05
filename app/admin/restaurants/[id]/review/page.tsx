// /admin/restaurants/[id]/review — Step 18: Admin Review Screen.
//
// Server component — wraps the client ReviewContent in a Suspense boundary.
// Next.js App Router requires Suspense around any client component that uses
// useSearchParams() or async data patterns. The fallback renders the layout
// skeleton immediately, avoiding any blank state.
//
// Security: Layer 1 (middleware.ts) has already redirected unauthenticated users.
// Layer 2 auth checks remain in the API route handlers and in ReviewContent's
// TanStack Query error handling (401 from API surfaces as an error state).
//
// DS §16.3: loading skeleton matches the exact content geometry.

import { Suspense } from 'react'
import { Skeleton }  from '@/components/ui/skeleton'
import { ReviewContent } from 'features/admin/components/review/ReviewContent'

// ─── Suspense fallback ─────────────────────────────────────────

function ReviewPageSkeleton() {
  return (
    <div className="p-6 space-y-6 pb-28" aria-busy="true" aria-label="Loading review">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-4 w-16 mt-1" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-neutral-200 p-4 space-y-2.5"
              aria-hidden="true"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {/* Score widget skeleton */}
          <div className="rounded-lg border border-neutral-200 overflow-hidden" aria-hidden="true">
            <div className="px-4 py-4">
              <Skeleton className="h-10 w-28" />
            </div>
            <div className="border-t border-neutral-200">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-neutral-200 last:border-0">
                  <Skeleton className="h-3.5 w-3.5 rounded-full" static />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-5" static />
                </div>
              ))}
            </div>
          </div>
          {/* Notes skeleton */}
          <div className="rounded-lg border border-neutral-200 p-4 space-y-2" aria-hidden="true">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>

      {/* Dishes */}
      <div className="rounded-lg border border-neutral-200 overflow-hidden" aria-hidden="true">
        <div className="px-4 py-3 bg-neutral-100 border-b border-neutral-200">
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-4.5 w-4.5 rounded-full" static />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-16" static />
          </div>
        ))}
      </div>

      {/* Photos */}
      <div className="rounded-lg border border-neutral-200 overflow-hidden" aria-hidden="true">
        <div className="px-4 py-3 bg-neutral-100 border-b border-neutral-200">
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-neutral-200 overflow-hidden" aria-hidden="true">
        <div className="px-4 py-3 bg-neutral-100 border-b border-neutral-200">
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
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
      </div>

    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────

export default function ReviewPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <Suspense fallback={<ReviewPageSkeleton />}>
      <ReviewContent restaurantId={params.id} />
    </Suspense>
  )
}

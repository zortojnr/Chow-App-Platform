// /admin/restaurants/[id]/intelligence — Step 19: Admin Intelligence Screen.
//
// Server component — wraps the client IntelligenceContent in a Suspense boundary.
// Security: Layer 1 (middleware.ts) already blocked unauthenticated users.
// Layer 2 checks remain in each API route handler.
//
// DS §16.3: loading skeleton matches the exact content geometry of the page.

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { IntelligenceContent } from 'features/admin/components/intelligence/IntelligenceContent'

// ─── Suspense fallback ─────────────────────────────────────────

function IntelligencePageSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-busy="true" aria-label="Loading intelligence editor">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-4 w-24 mt-1" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4" aria-hidden="true">
          {/* Restaurant fields card */}
          <div className="rounded-lg border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <div className="px-4 py-2 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-2 border-b border-neutral-200 last:border-0 space-y-1">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Dishes card */}
          <div className="rounded-lg border border-neutral-200 overflow-hidden" aria-hidden="true">
            <div className="px-4 py-3 bg-neutral-100 border-b border-neutral-200">
              <Skeleton className="h-3 w-14" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-neutral-100 last:border-0">
                <Skeleton className="h-4 w-4 rounded-full mt-0.5 shrink-0" static />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-7 w-full" />
                </div>
                <Skeleton className="h-8 w-16 shrink-0" static />
              </div>
            ))}
          </div>

          {/* Photos card */}
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
        </div>

        <div className="space-y-4" aria-hidden="true">
          {/* Score widget skeleton */}
          <div className="rounded-lg border border-neutral-200 overflow-hidden">
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
          <div className="rounded-lg border border-neutral-200 p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<IntelligencePageSkeleton />}>
      <IntelligenceContent restaurantId={id} />
    </Suspense>
  )
}

// /admin/queue — Step 17: Admin Verification Queue page.
//
// Server component — wraps the client QueueContent in a Suspense boundary.
// Next.js App Router requires Suspense around any client component that calls
// useSearchParams(). The fallback skeleton prevents layout shift during hydration.
//
// Design: DS §10.3 (Admin Queue Card), §10.7 (Tables), §11.1–11.3 (Admin UI).
// Security: Layer 1 (middleware.ts) has already redirected unauthenticated users.
// Layer 2 auth checks remain in the API route handlers.

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { QueueContent } from 'features/admin/components/queue/QueueContent'

// ─── Suspense fallback ─────────────────────────────────────────
// Matches the layout of QueueContent so there is no layout shift.
// DS §16.3: admin queue row — full-width row with 4 text block placeholders.

function QueuePageSkeleton() {
  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40 rounded" />
        <Skeleton className="h-9 w-32 rounded" />
        <Skeleton className="h-9 w-36 rounded" />
        <Skeleton className="h-9 w-24 rounded" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-neutral-200 overflow-hidden">
        {/* Header row */}
        <div className="bg-neutral-100 border-b border-neutral-200 px-4 py-3">
          <Skeleton className="h-3 w-48" static />
        </div>
        {/* Body rows — DS §16.3 queue row pattern */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-neutral-100 last:border-0"
          >
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-20 hidden md:block" />
            <Skeleton className="h-4 w-10 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────

export default function QueuePage() {
  return (
    <Suspense fallback={<QueuePageSkeleton />}>
      <QueueContent />
    </Suspense>
  )
}

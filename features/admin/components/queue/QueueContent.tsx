// QueueContent — admin verification queue main client component.
// DS §10.3 (Admin Queue Card), §10.7 (Admin Tables), §11.1–11.3 (Admin UI language),
// §15.2 (empty states), §16.3 (loading skeleton), §17.5 (admin error patterns),
// §7.5 (stagger animation), §8.4 (ARIA — table role, scope, aria-busy).
//
// All columns: Restaurant | Status | City | Assigned | Age | Score | Action
// Mobile: Restaurant + Status + Score + Action visible; City/Assigned/Age hidden.
// Tablet (md+): City revealed. Desktop (lg+): Assigned + Age revealed.
//
// URL search params carry filter state so links are shareable and refresh-safe.

'use client'

import { useCallback, useTransition } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, CheckCircle, Filter, User, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { apiGetPaginated } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { VerificationStatusBadge } from 'features/verification/components/VerificationStatusBadge'
import { QueueFilters, type QueueFilterValues } from './QueueFilters'
import type { QueueRecord } from 'features/admin/services/queue.service'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────

function formatAge(date: string | Date): string {
  const ms  = Date.now() - new Date(date).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60)  return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)    return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

// DS §10.3: < 0.40 → status-error | 0.40–0.69 → status-warning | 0.70+ → green-500
function scoreClass(score: number): string {
  if (score < 0.40) return 'text-status-error'
  if (score < 0.70) return 'text-status-warning'
  return 'text-green-500'
}

// ─── Filter state helpers ──────────────────────────────────────

const DEFAULTS: QueueFilterValues = {
  status:     'PENDING_REVIEW',
  sort:       'oldest',
  assignedTo: 'all',
  city:       '',
}

function readFilters(params: URLSearchParams): QueueFilterValues {
  return {
    status:     params.get('status')     ?? DEFAULTS.status,
    sort:       params.get('sort')       ?? DEFAULTS.sort,
    assignedTo: params.get('assignedTo') ?? DEFAULTS.assignedTo,
    city:       params.get('city')       ?? DEFAULTS.city,
  }
}

function isFiltered(f: QueueFilterValues): boolean {
  return (
    f.status !== DEFAULTS.status ||
    f.sort   !== DEFAULTS.sort   ||
    f.assignedTo !== DEFAULTS.assignedTo ||
    f.city !== ''
  )
}

function buildApiUrl(f: QueueFilterValues, page: number): string {
  const p = new URLSearchParams({
    status: f.status,
    sort:   f.sort,
    page:   String(page),
    limit:  '20',
  })
  if (f.assignedTo !== 'all') p.set('assignedTo', f.assignedTo)
  if (f.city.trim())          p.set('city', f.city.trim())
  return `/api/v1/admin/verification/queue?${p.toString()}`
}

function buildPageUrl(
  pathname: string,
  filters: QueueFilterValues,
  page: number,
): string {
  const p = new URLSearchParams()
  if (filters.status     !== DEFAULTS.status)     p.set('status', filters.status)
  if (filters.sort       !== DEFAULTS.sort)       p.set('sort', filters.sort)
  if (filters.assignedTo !== DEFAULTS.assignedTo) p.set('assignedTo', filters.assignedTo)
  if (filters.city.trim())                        p.set('city', filters.city.trim())
  if (page > 1)                                   p.set('page', String(page))
  const qs = p.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

// ─── Loading skeleton ──────────────────────────────────────────
// DS §16.3: Admin queue row — full-width row with 4 text block placeholders.

function QueueRowSkeleton({ delay }: { delay: number }) {
  return (
    <tr
      aria-hidden="true"
      style={{
        animationName:         'rowFadeIn',
        animationDuration:     '200ms',
        animationDelay:        `${delay}ms`,
        animationFillMode:     'both',
        animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
      }}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-24 md:hidden" />
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-24 rounded-full" />
      </td>
      <td className="hidden md:table-cell px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="hidden lg:table-cell px-4 py-3">
        <Skeleton className="h-4 w-14" />
      </td>
      <td className="hidden lg:table-cell px-4 py-3">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="px-4 py-3 w-10" />
    </tr>
  )
}

// ─── Empty states ──────────────────────────────────────────────
// DS §15.2: queue empty (green check) and filtered empty (filter icon + clear CTA).

function QueueEmpty({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean
  onClear:    () => void
}) {
  if (hasFilters) {
    return (
      <tr>
        <td colSpan={7}>
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Filter
              size={32}
              strokeWidth={1.5}
              className="text-neutral-300"
              aria-hidden="true"
            />
            {/* DS §15.1: Headline — font-sans (admin only), text-2xl, font-semibold, neutral-800 */}
            <p className="text-2xl font-semibold text-neutral-800 font-sans">
              No results for these filters
            </p>
            <p className="text-base text-neutral-600">
              Try adjusting or clearing the filters.
            </p>
            {/* DS §15.1: CTA — Primary button */}
            <button
              type="button"
              onClick={onClear}
              className={cn(
                'mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-md text-base font-semibold',
                'bg-amber-500 text-neutral-0',
                'hover:bg-amber-600 transition-colors duration-[100ms] ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
              )}
            >
              Clear filters
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={7}>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CheckCircle
            size={32}
            strokeWidth={1.5}
            className="text-green-500"
            aria-hidden="true"
          />
          <p className="text-2xl font-semibold text-neutral-800 font-sans">
            Queue is clear
          </p>
          <p className="text-base text-neutral-600">
            All submissions have been reviewed.
          </p>
        </div>
      </td>
    </tr>
  )
}

// ─── Table row ─────────────────────────────────────────────────
// DS §10.3 Admin Queue Card structure:
// Restaurant name | Status badge | City | Assigned | Age | Score pill | Action chevron
// DS §7.5: stagger 40ms per row, max 6 (index capped at 5).

function QueueRow({ record, index }: { record: QueueRecord; index: number }) {
  return (
    <tr
      className="group border-b border-neutral-100 hover:bg-neutral-50 transition-colors duration-[100ms] ease-out"
      style={{
        animationName:           'rowFadeIn',
        animationDuration:       '200ms',
        animationDelay:          `${Math.min(index, 5) * 40}ms`,
        animationFillMode:       'both',
        animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
      }}
    >
      {/* Restaurant name — primary link. DS §11.1: every row is an action. */}
      <td className="px-4 py-3" style={{ minHeight: '48px' }}>
        <div className="flex flex-col gap-0.5">
          <Link
            href={`/admin/restaurants/${record.restaurantId}/review`}
            className={cn(
              'text-base font-semibold text-neutral-900 leading-snug',
              'hover:text-amber-600 transition-colors duration-[100ms] ease-out',
              'focus-visible:outline-none focus-visible:underline',
            )}
          >
            {record.restaurantName}
          </Link>
          {/* City + state visible on mobile where the City column is hidden */}
          <span className="text-sm text-neutral-500 md:hidden">
            {record.city}, {record.state}
          </span>
        </div>
      </td>

      {/* Status badge — DS §10.4, §11.5 admin language */}
      <td className="px-4 py-3">
        <VerificationStatusBadge
          status={record.currentStatus as Parameters<typeof VerificationStatusBadge>[0]['status']}
        />
      </td>

      {/* City — hidden on mobile */}
      <td className="hidden md:table-cell px-4 py-3 text-sm text-neutral-600">
        {record.city}
      </td>

      {/* Assignment — hidden below lg. DS does not have admin names in QueueRecord. */}
      <td className="hidden lg:table-cell px-4 py-3">
        {record.assignedTo ? (
          <span className="inline-flex items-center gap-1 text-sm text-amber-700">
            <User size={14} strokeWidth={1.5} aria-hidden="true" />
            Assigned
          </span>
        ) : (
          <span className="text-sm text-neutral-400" aria-label="Unassigned">—</span>
        )}
      </td>

      {/* Age — hidden below lg. DS §3.4: admin data in JetBrains Mono */}
      <td className="hidden lg:table-cell px-4 py-3 font-mono text-sm text-neutral-500">
        {formatAge(record.submittedAt)}
      </td>

      {/* Confidence score — DS §10.3 score color thresholds, JetBrains Mono */}
      <td className="px-4 py-3">
        <span
          className={cn('font-mono text-sm font-medium', scoreClass(record.confidenceScore))}
          aria-label={`Confidence score: ${Math.round(record.confidenceScore * 100)}%`}
        >
          {Math.round(record.confidenceScore * 100)}%
        </span>
      </td>

      {/* Action chevron — secondary link, accessible label */}
      <td className="px-4 py-3 w-10">
        <Link
          href={`/admin/restaurants/${record.restaurantId}/review`}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded',
            'text-neutral-400 group-hover:text-amber-500',
            'transition-colors duration-[100ms] ease-out',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500',
          )}
          aria-label={`Review ${record.restaurantName}`}
          tabIndex={-1} // primary link is the restaurant name; chevron is decorative nav
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </Link>
      </td>
    </tr>
  )
}

// ─── Pagination ────────────────────────────────────────────────

function QueuePagination({
  page,
  total,
  limit,
  onPage,
}: {
  page:   number
  total:  number
  limit:  number
  onPage: (p: number) => void
}) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const start = (page - 1) * limit + 1
  const end   = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
      <p className="text-sm text-neutral-500">
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={cn(
            'h-8 px-3 rounded text-sm font-medium',
            'border border-neutral-200 bg-neutral-0 text-neutral-700',
            'hover:bg-neutral-50 transition-colors duration-[100ms] ease-out',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500',
          )}
        >
          Previous
        </button>
        <span className="text-sm text-neutral-500 min-w-[88px] text-center">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className={cn(
            'h-8 px-3 rounded text-sm font-medium',
            'border border-neutral-200 bg-neutral-0 text-neutral-700',
            'hover:bg-neutral-50 transition-colors duration-[100ms] ease-out',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500',
          )}
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────

export function QueueContent() {
  const searchParams        = useSearchParams()
  const router              = useRouter()
  const pathname            = usePathname()
  const [, startTransition] = useTransition()

  const filters = readFilters(searchParams)
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  // TanStack Query — staleTime 30s matches QueueBadge polling cadence
  const { data, isLoading, isError, error } = useQuery({
    queryKey:        ['admin', 'queue', filters, page],
    queryFn:         () => apiGetPaginated<QueueRecord[]>(buildApiUrl(filters, page)),
    placeholderData: (prev) => prev, // keep previous data while fetching (avoids flash)
    staleTime:       30_000,
  })

  const navigate = useCallback(
    (patch: Partial<QueueFilterValues & { page: number }>) => {
      startTransition(() => {
        const nextFilters: QueueFilterValues = { ...filters, ...patch }
        const nextPage = patch.page ?? 1 // filter changes always reset to page 1
        router.replace(buildPageUrl(pathname, nextFilters, nextPage), { scroll: false })
      })
    },
    [filters, pathname, router, startTransition],
  )

  const handleFilterChange = useCallback(
    (patch: Partial<QueueFilterValues>) => navigate(patch),
    [navigate],
  )

  const handleClear = useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }))
  }, [pathname, router, startTransition])

  const handlePage = useCallback(
    (p: number) => navigate({ page: p }),
    [navigate],
  )

  const records = data?.data ?? []
  const meta    = data?.meta

  return (
    <div className="p-6 space-y-5">

      {/* Page header — DS §11.3: admin type capped at text-2xl, Plus Jakarta Sans only */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 font-sans leading-tight">
          Verification Queue
        </h1>
        {/* Show total only once loaded — avoids layout shift */}
        <p className="mt-1 text-sm text-neutral-500 h-5">
          {meta ? `${meta.total} submission${meta.total !== 1 ? 's' : ''}` : null}
        </p>
      </div>

      {/* Filter bar */}
      <QueueFilters
        values={filters}
        onChange={handleFilterChange}
        onClear={handleClear}
        isFiltered={isFiltered(filters)}
      />

      {/* Error banner — DS §17.5: admin errors are informative, include specific reason */}
      {isError && (
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
            <span className="font-semibold text-neutral-900">Failed to load queue. </span>
            <span className="text-neutral-600">
              {error instanceof Error ? error.message : 'An unexpected error occurred.'}
            </span>
          </div>
        </div>
      )}

      {/* Queue table — DS §10.7 */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full"
            role="table"
            aria-label="Verification queue"
          >

            {/* DS §10.7: header row neutral-100 bg, text-sm semibold neutral-500, uppercase */}
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-200">
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                >
                  Restaurant
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                >
                  City
                </th>
                <th
                  scope="col"
                  className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                >
                  Assigned
                </th>
                <th
                  scope="col"
                  className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                >
                  Age
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                >
                  Score
                </th>
                <th scope="col" className="px-4 py-3 w-10">
                  <span className="sr-only">Review</span>
                </th>
              </tr>
            </thead>

            {/* DS §8.4: aria-busy during load, aria-live for row updates */}
            <tbody aria-busy={isLoading} aria-live="polite">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <QueueRowSkeleton key={i} delay={Math.min(i, 5) * 40} />
                ))
              ) : records.length === 0 ? (
                <QueueEmpty hasFilters={isFiltered(filters)} onClear={handleClear} />
              ) : (
                records.map((record, i) => (
                  <QueueRow
                    key={record.verificationRecordId}
                    record={record}
                    index={i}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — only shown when there is more than one page */}
        {meta && meta.total > meta.limit && (
          <QueuePagination
            page={page}
            total={meta.total}
            limit={meta.limit}
            onPage={handlePage}
          />
        )}
      </div>
    </div>
  )
}

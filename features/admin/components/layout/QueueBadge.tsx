// QueueBadge — PENDING_REVIEW count badge for the sidebar Queue nav item.
// Admin UI Architecture Review §3.2 — polls every 60 seconds.
// Resolved UNRESOLVED-1: amber pill variant, right-aligned in nav item.
// aria-live="polite" so screen readers announce count updates without interruption.
// Returns null when count is 0 — badge is hidden when queue is clear. §10.4

'use client'

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { apiGetPaginated } from '@/lib/api'
import type { QueueRecord } from 'features/admin/services/queue.service'

export function QueueBadge() {
  const { data } = useQuery({
    queryKey: ['admin', 'queue-count'],
    queryFn:  () =>
      apiGetPaginated<QueueRecord[]>(
        '/api/v1/admin/verification/queue?status=PENDING_REVIEW&limit=1',
      ),
    // Poll every 60 seconds. staleTime 30s: don't re-fetch if a fresh result
    // is already in cache from a recent queue page load.
    refetchInterval: 60_000,
    staleTime:       30_000,
    // Don't show an error if the count fails — just hide the badge silently.
    throwOnError: false,
  })

  const count = data?.meta?.total ?? 0
  if (count === 0) return null

  return (
    <Badge
      variant="amber"
      aria-label={`${count} submission${count === 1 ? '' : 's'} pending review`}
      aria-live="polite"
      className="ml-auto"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  )
}

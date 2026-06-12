'use client'

// DistanceBadge — Track 7
//
// Displays formatted distance to a restaurant.
// Renders nothing when distanceKm is null (restaurant not geocoded or no GPS).
// Design: neutral-400 text, small MapPin prefix.
// Governed by: track-07-navigation-location.md §7.2

import { Navigation } from 'lucide-react'
import { formatDistance } from '@/lib/geo'
import { cn } from '@/lib/utils'

interface DistanceBadgeProps {
  distanceKm: number | null
  className?: string
}

export function DistanceBadge({ distanceKm, className }: DistanceBadgeProps) {
  if (distanceKm === null) return null

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs text-neutral-400', className)}
      aria-label={`${formatDistance(distanceKm)} away`}
    >
      <Navigation size={11} strokeWidth={1.5} aria-hidden="true" />
      {formatDistance(distanceKm)}
    </span>
  )
}

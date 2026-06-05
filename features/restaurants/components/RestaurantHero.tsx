// RestaurantHero — restaurant-listing-track.md §8.2, §8.5, §13.2
//
// Hero image section for the restaurant profile page.
// Primary photo (isPrimary=true) fills the container. Falls back to the first
// verified photo if no primary is marked. When no photos exist, renders the
// Camera empty state (§8.4).
//
// Aspect: 3:2 mobile, 16:9 (aspect-video) desktop (lg+). §17.5
// Gradient: bottom-to-transparent for text legibility only. §8.1
// Overlay: TrustBadge + restaurant name, bottom-left, aria-hidden.
//          The semantic <h1> lives in the Identity Section below — not here.
//
// fetchPriority="high" marks this as the LCP image for Core Web Vitals.
// This is a Server Component — no hooks, no event handlers.

import { Camera } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { TrustBadge } from './TrustBadge'
import { cn } from '@/lib/utils'
import type { ScoreBand } from './TrustBadge'

interface RestaurantHeroProps {
  photos:              { id: string; url: string; isPrimary: boolean }[]
  name:                string
  confidenceScoreBand: ScoreBand
  className?:          string
}

export function RestaurantHero({
  photos,
  name,
  confidenceScoreBand,
  className,
}: RestaurantHeroProps) {
  const primaryPhoto = photos.find((p) => p.isPrimary) ?? photos[0] ?? null

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-neutral-100',
        'aspect-[3/2] lg:aspect-video',
        className,
      )}
    >
      {primaryPhoto ? (
        <>
          {/* Hero image — LCP element */}
          <img
            src={primaryPhoto.url}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            loading="eager"
            decoding="sync"
            className="w-full h-full object-cover"
          />

          {/* Bottom-to-transparent gradient — text legibility §8.1 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(26,23,20,0.6) 0%, transparent 60%)',
            }}
            aria-hidden="true"
          />

          {/* Overlay: TrustBadge + name — decorative (§8.5, §13.2) */}
          {/* Semantic <h1> is in the Identity Section below */}
          <div
            className="absolute bottom-4 left-4 lg:bottom-6 lg:left-6 flex flex-col items-start gap-2"
            aria-hidden="true"
          >
            <TrustBadge scoreBand={confidenceScoreBand} size="sm" />
            <p className="font-display font-bold text-neutral-0 leading-tight drop-shadow text-2xl lg:text-4xl">
              {name}
            </p>
          </div>
        </>
      ) : (
        /* Empty state — §8.4: Camera icon, "Photos coming soon", no CTA */
        <div
          className="flex flex-col items-center justify-center h-full gap-3 text-center px-6"
          role="img"
          aria-label={`${name} — no photos available`}
        >
          <Camera size={48} strokeWidth={1.5} className="text-neutral-300" aria-hidden="true" />
          <div>
            <p className="font-display text-2xl font-semibold text-neutral-700">
              Photos coming soon
            </p>
            <p className="text-base text-neutral-500 mt-1">
              This restaurant hasn't had photos verified yet.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────
// Full-width photo block + badge stub + name stub — §13.7

export function RestaurantHeroSkeleton() {
  return (
    <div
      className="relative w-full aspect-[3/2] lg:aspect-video overflow-hidden bg-neutral-100"
      aria-busy="true"
      aria-label="Loading restaurant hero"
    >
      <Skeleton className="w-full h-full rounded-none" />
      <div className="absolute bottom-4 left-4 lg:bottom-6 lg:left-6 flex flex-col items-start gap-2">
        <Skeleton className="h-[26px] w-[86px] rounded-full" />
        <Skeleton className="h-8 w-52 lg:h-10 lg:w-72 rounded" />
      </div>
    </div>
  )
}

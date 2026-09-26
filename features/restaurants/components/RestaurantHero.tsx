'use client'

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

import Image from 'next/image'
import { useState } from 'react'
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
  showOverlay?:        boolean
}

export function RestaurantHero({
  photos,
  name,
  confidenceScoreBand,
  className,
  showOverlay = true,
}: RestaurantHeroProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const primaryPhoto = photos.find((p) => p.isPrimary) ?? photos[0] ?? null

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-neutral-100',
        'aspect-[3/2] lg:aspect-video',
        className,
      )}
    >
      {primaryPhoto && !imageFailed ? (
        <>
          <Image
            src={primaryPhoto.url}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            onError={() => setImageFailed(true)}
            priority
            className="object-cover"
          />
          {showOverlay && (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(26,23,20,0.6) 0%, transparent 60%)' }}
                aria-hidden="true"
              />
              <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2 lg:bottom-6 lg:left-6" aria-hidden="true">
                <TrustBadge scoreBand={confidenceScoreBand} size="sm" />
                <p className="font-display text-2xl font-bold leading-tight text-neutral-0 drop-shadow lg:text-4xl">
                  {name}
                </p>
              </div>
            </>
          )}
        </>
      ) : (
        <div
          className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-0 via-neutral-50 to-neutral-200 px-6 text-center"
          role="img"
          aria-label={`${name} — ${primaryPhoto ? 'photo unavailable' : 'no photos available'}`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-green-700 shadow-sm">
            <Camera size={24} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="max-w-sm">
            <p className="font-display text-xl font-semibold text-neutral-800 sm:text-2xl">
              {primaryPhoto ? 'Restaurant photo unavailable' : 'Photos coming soon'}
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              {primaryPhoto
                ? 'We could not load this image. The restaurant profile details are still available below.'
                : 'Verified photos have not been added to this profile yet.'}
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

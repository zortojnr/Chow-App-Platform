'use client'

// PhotoGallery — design-system-v1.md §10.10, restaurant-listing-track.md §8.1–8.6
//
// Displays the verified photo gallery for a restaurant profile.
// Only photos passed in are shown — the caller is responsible for filtering
// (the API already returns only isVerified photos).
//
// Mobile (< md):
//   Horizontal snap-scroll gallery. Each photo fills the container width.
//   "N / M" count badge top-right updates as the user scrolls. §8.6
//   Tap → opens PhotoLightbox.
//
// Tablet (md+): 2-column grid, radius-xl cells, 1:1 aspect ratio.
// Desktop (lg+): 3-column grid.
//
// Empty state (zero photos) — §8.4:
//   Camera outline icon (48px, neutral-300)
//   "Photos coming soon" — Fraunces text-2xl neutral-700
//   "This restaurant hasn't had photos verified yet." — text-base neutral-500
//   No CTA.
//
// Skeleton: 3-cell grid (§16.3).
//
// Accessibility: each photo button has aria-label with index and restaurant name.
//   Count badge is aria-live polite so screen readers announce changes on scroll.

import { useCallback, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PhotoLightbox } from './PhotoLightbox'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────

type Photo = { id: string; url: string; isPrimary: boolean }

interface PhotoGalleryProps {
  photos:         Photo[]
  restaurantName: string
  className?:     string
}

// ─── Component ─────────────────────────────────────────────────

export function PhotoGallery({
  photos,
  restaurantName,
  className,
}: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [scrollIndex, setScrollIndex]     = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Track current photo index in scroll mode (mobile)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setScrollIndex(Math.max(0, Math.min(idx, photos.length - 1)))
  }, [photos.length])

  // ── Empty state ──────────────────────────────────────────────
  // §8.4: Camera outline, "Photos coming soon", no CTA
  if (photos.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-14 px-6 text-center',
          className,
        )}
        role="status"
        aria-label="No photos available"
      >
        <Camera
          size={48}
          strokeWidth={1.5}
          className="text-neutral-300 mb-4"
          aria-hidden="true"
        />
        <h3 className="font-display text-2xl font-semibold text-neutral-700 mb-2">
          Photos coming soon
        </h3>
        <p className="text-base text-neutral-500 max-w-xs">
          This restaurant hasn't had photos verified yet.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={cn('relative', className)}>
        {/* ── Photo grid / scroll gallery ────────────────── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            // Mobile: horizontal snap-scroll, one photo per "page"
            'flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none',
            // Tablet+: 2-column grid (overflow reverts to auto/visible)
            'md:grid md:grid-cols-2 md:overflow-visible',
            // Desktop: 3-column grid
            'lg:grid-cols-3',
          )}
        >
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className={cn(
                // Mobile: full-width snap-start item (prevents flex shrink)
                'min-w-full flex-shrink-0 snap-start',
                // Tablet+: let the grid control width
                'md:min-w-0',
                // Both: 1:1 square, clipped, rounded
                'relative aspect-square overflow-hidden rounded-xl',
                'group cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
                'transition-opacity duration-fast hover:opacity-95',
              )}
              aria-label={`Open photo ${i + 1} of ${photos.length} for ${restaurantName}`}
            >
              <img
                src={photo.url}
                alt={`${restaurantName} — photo ${i + 1}`}
                className={cn(
                  'w-full h-full object-cover',
                  // Subtle zoom on hover — photography direction §App.B
                  'transition-transform duration-[400ms] ease-out group-hover:scale-[1.04]',
                )}
                loading="lazy"
                decoding="async"
              />

              {/* Dark overlay flash on hover */}
              <div
                className="absolute inset-0 bg-neutral-900/0 group-hover:bg-neutral-900/10 transition-colors duration-normal pointer-events-none"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>

        {/* ── Scroll count badge (mobile only, > 1 photo) ─── */}
        {/* §8.6: "N / M" top-right, text-xs neutral-0 on rgba(0,0,0,0.5) */}
        {photos.length > 1 && (
          <div
            className={cn(
              'absolute top-3 right-3 z-10',
              'px-2.5 py-1 rounded-full',
              'bg-black/50 text-neutral-0 text-xs font-medium tabular-nums',
              'pointer-events-none select-none',
              // Count badge only relevant in scroll mode
              'md:hidden',
            )}
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Photo ${scrollIndex + 1} of ${photos.length}`}
          >
            {scrollIndex + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          restaurantName={restaurantName}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────
// 3-cell square skeleton grid — §16.3

export function PhotoGallerySkeleton() {
  return (
    <div
      className="grid grid-cols-3 gap-3"
      aria-busy="true"
      aria-label="Loading photos"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-xl" />
      ))}
    </div>
  )
}

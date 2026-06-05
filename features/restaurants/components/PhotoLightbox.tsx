'use client'

// PhotoLightbox — design-system-v1.md §10.6, restaurant-listing-track.md §8.1
//
// Full-screen photo viewer. Opened by PhotoGallery when a photo is tapped.
//
// Layout: fixed full viewport, black background. Image centered, max-width/height
// preserving aspect ratio. Prev/Next buttons on sides. Close top-right. Counter
// bottom-center.
//
// Keyboard: Escape → close, ArrowLeft → prev, ArrowRight → next.
// Touch:    swipe left → next, swipe right → prev (50px threshold).
// Animation: backdrop + image fade-in 300ms ease-out on open; reversed on close.
//            Reduced motion: instant (§7.6).
//
// Body scroll is locked while the lightbox is open.
//
// Accessibility: role="dialog", aria-modal, aria-label, aria-live counter.
//   Focus moves to close button on open and returns to the gallery trigger on close.
//   Keyboard navigation cycles through photos (wraps at boundaries).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────

type Photo = { id: string; url: string; isPrimary: boolean }

interface PhotoLightboxProps {
  photos:         Photo[]
  initialIndex:   number
  restaurantName: string
  isOpen:         boolean
  onClose:        () => void
}

// ─── Component ─────────────────────────────────────────────────

export function PhotoLightbox({
  photos,
  initialIndex,
  restaurantName,
  isOpen,
  onClose,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [visible, setVisible]           = useState(false)
  const closeButtonRef                  = useRef<HTMLButtonElement>(null)
  const touchStartX                     = useRef<number>(0)

  // Sync index when lightbox is (re)opened on a different photo
  useEffect(() => {
    if (isOpen) setCurrentIndex(initialIndex)
  }, [isOpen, initialIndex])

  // Fade-in / fade-out with a tiny delay so the CSS transition fires
  useEffect(() => {
    if (isOpen) {
      // Defer by one frame to trigger the CSS transition
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setVisible(false)
    }
  }, [isOpen])

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Focus close button when opened
  useEffect(() => {
    if (isOpen && visible) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen, visible])

  // Navigation helpers (wrap-around)
  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + photos.length) % photos.length)
  }, [photos.length])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % photos.length)
  }, [photos.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onClose()
      if (e.key === 'ArrowLeft')   goPrev()
      if (e.key === 'ArrowRight')  goNext()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose, goPrev, goNext])

  // Touch swipe — 50px threshold
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 50) {
      delta > 0 ? goNext() : goPrev()
    }
  }

  if (!isOpen) return null

  const photo = photos[currentIndex]

  return (
    // Backdrop — §7.4 modal enter 300ms ease-out
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${currentIndex + 1} of ${photos.length} — ${restaurantName}`}
      className={cn(
        'fixed inset-0 z-50',
        'bg-black',
        'transition-opacity duration-slow',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button — top-right */}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className={cn(
          'absolute top-4 right-4 z-10',
          'flex items-center justify-center',
          'w-10 h-10 rounded-full',
          'bg-black/50 text-neutral-0',
          'hover:bg-black/70 transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-0/60',
        )}
        aria-label="Close photo viewer"
      >
        <X size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>

      {/* Image — centered, max 90% of viewport */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center p-4 md:p-12',
          'transition-opacity duration-slow',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}                         // tap outside image → close
        aria-hidden="true"
      >
        <img
          src={photo.url}
          alt={`${restaurantName} — photo ${currentIndex + 1} of ${photos.length}`}
          className="max-w-full max-h-full object-contain select-none"
          onClick={(e) => e.stopPropagation()}    // tap on image itself → don't close
          draggable={false}
        />
      </div>

      {/* Prev button — only when multiple photos */}
      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 z-10',
            'flex items-center justify-center',
            'w-10 h-10 rounded-full',
            'bg-black/50 text-neutral-0',
            'hover:bg-black/70 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-0/60',
          )}
          aria-label={`Previous photo (${currentIndex === 0 ? photos.length : currentIndex} of ${photos.length})`}
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}

      {/* Next button — only when multiple photos */}
      {photos.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 z-10',
            'flex items-center justify-center',
            'w-10 h-10 rounded-full',
            'bg-black/50 text-neutral-0',
            'hover:bg-black/70 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-0/60',
          )}
          aria-label={`Next photo (${((currentIndex + 2) > photos.length ? 1 : currentIndex + 2)} of ${photos.length})`}
        >
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}

      {/* Photo counter — bottom-center, §8.6 text-xs neutral-0 on rgba(0,0,0,0.5) */}
      {photos.length > 1 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-black/50 text-neutral-0 text-xs font-medium"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Photo ${currentIndex + 1} of ${photos.length}`}
        >
          {currentIndex + 1} / {photos.length}
        </div>
      )}
    </div>
  )
}

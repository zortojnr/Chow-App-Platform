'use client'

// BackButton — restaurant-listing-track.md §13.2
//
// Returns the visitor to wherever they came from (browse index, dish search,
// Near You) instead of forcing a fixed route, since the detail page is
// reachable from several entry points. Falls back to fallbackHref when there
// is no prior entry in this tab's history (e.g. a shared link opened fresh).

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  fallbackHref?: string
  label?:        string
  // 'inline' — text + icon, used in the desktop content column.
  // 'overlay' — circular icon-only button over the full-bleed mobile hero photo.
  variant?:      'inline' | 'overlay'
  className?:    string
}

export function BackButton({
  fallbackHref = '/restaurants',
  label        = 'Back',
  variant      = 'inline',
  className,
}: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  if (variant === 'overlay') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'absolute top-4 left-4 z-10',
          'flex items-center justify-center w-10 h-10 rounded-full',
          'bg-black/50 text-neutral-0',
          'hover:bg-black/70 transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-0/60',
          className,
        )}
        aria-label={label}
      >
        <ArrowLeft size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600',
        'hover:text-neutral-900 transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:shadow-brand rounded',
        className,
      )}
      aria-label={label}
    >
      <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
      {label}
    </button>
  )
}

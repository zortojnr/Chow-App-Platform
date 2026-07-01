'use client'

// ConsumerTopNav — desktop-only sticky header (≥lg breakpoint).
// Hidden on mobile where ConsumerBottomNav provides navigation.
//
// Layout (left → right):
//   Wordmark · Discover link · Search pill (tap → /search) · [spacer] · Submit CTA · Sign in / Saved
//
// Right-most slot is design-system-v1.md §10.5's "Login / Profile avatar" —
// Track 5 (User Accounts) implements it as a Sign in link (unauthenticated)
// or a Saved link (authenticated). No profile page exists yet, so no avatar.
//
// Governed by: Phase C launch readiness, design-system-v1.md §9, §10.5

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConsumerTopNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { status } = useSession()

  return (
    <header
      className={cn(
        'hidden lg:flex items-center sticky top-0 z-40',
        'h-[60px] px-6 gap-6',
        'bg-neutral-0 border-b border-neutral-200',
      )}
    >
      {/* Wordmark */}
      <Link
        href="/"
        className="font-display text-xl font-bold text-amber-500 shrink-0 leading-none focus-visible:outline-none focus-visible:shadow-brand rounded-sm"
      >
        Chow Here
      </Link>

      {/* Primary nav link */}
      <nav className="flex items-center">
        <Link
          href="/"
          className={cn(
            'px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:shadow-brand',
            pathname === '/'
              ? 'text-neutral-900 bg-neutral-100'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
          )}
        >
          Discover
        </Link>
      </nav>

      {/* Compact search pill — navigates to /search */}
      <button
        type="button"
        onClick={() => router.push('/search')}
        className={cn(
          'flex items-center gap-2 px-4 h-9 rounded-full',
          'bg-neutral-100 hover:bg-neutral-200',
          'text-sm text-neutral-400',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:shadow-brand',
          'w-56',
        )}
        aria-label="Open search"
      >
        <Search size={14} strokeWidth={1.5} aria-hidden="true" />
        <span className="truncate">Search for a dish...</span>
      </button>

      {/* Push CTA to the right */}
      <div className="flex-1" />

      {/* Submit CTA */}
      <Link
        href="/submit"
        className={cn(
          'shrink-0 inline-flex items-center h-9 px-4 rounded-[10px]',
          'bg-amber-500 text-neutral-0 text-sm font-semibold',
          'hover:bg-amber-600 transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:shadow-brand',
        )}
      >
        Submit a restaurant
      </Link>

      {/* Sign in / Saved — design-system-v1.md §10.5 right-side slot */}
      <Link
        href={status === 'authenticated' ? '/dashboard/saved' : '/signin'}
        className={cn(
          'shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-fast',
          'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
          'focus-visible:outline-none focus-visible:shadow-brand',
        )}
      >
        {status === 'authenticated' ? 'Saved' : 'Sign in'}
      </Link>
    </header>
  )
}

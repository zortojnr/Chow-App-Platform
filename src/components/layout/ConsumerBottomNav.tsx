'use client'

// Consumer bottom navigation bar — rendered inside app/(public)/layout.tsx.
// Visible only below the lg breakpoint (hidden on desktop, where a top nav lives).
//
// Design system §9.4: 4 items max, bottom of viewport, safe-area-aware.
// Track 3 spec §17.3: Discover / Search / Saved / Profile.
//
// Routes for Search, Saved, and Profile are Track 4 / Track 5 concerns.
// They render as inactive items in Track 3. Active state uses amber-500.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, Search, Bookmark, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Discover', href: '/',                icon: House },
  { label: 'Search',   href: '/search',           icon: Search },
  { label: 'Saved',    href: '/dashboard/saved',  icon: Bookmark },
  { label: 'Profile',  href: '/dashboard',        icon: User },
] as const

export function ConsumerBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-neutral-0 border-t border-neutral-200 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 h-full w-full',
                  'text-xs font-medium transition-colors duration-100',
                  isActive
                    ? 'text-amber-500'
                    : 'text-neutral-500 hover:text-neutral-700',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

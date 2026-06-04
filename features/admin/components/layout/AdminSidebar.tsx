// AdminSidebar — design-system-v1.md §10.5 (Admin Sidebar spec) + §11.2 (Admin color overrides)
//
// Desktop: 240px fixed sidebar, neutral-950 background, full viewport height.
// Mobile: slide-in drawer triggered by a hamburger button in the page header.
//
// Nav item active state: 3px amber-500 left border, neutral-0 text, neutral-800 background.
// Nav item inactive: neutral-300 text.
//
// Users nav item rendered only for SUPER role. §13.2 (Admin UI Architecture Review)
// ADMIN-role sessions never see the Users link — it is not shown as disabled or locked.
//
// Queue item includes <QueueBadge /> right-aligned (UNRESOLVED-1 resolved: amber pill).
//
// Sidebar footer: logged-in user display name + role, logout button, dark mode toggle.

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import {
  Inbox,
  Building2,
  Utensils,
  BarChart2,
  Users,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DarkModeToggle } from './DarkModeToggle'
import { QueueBadge } from './QueueBadge'
import type { Session } from 'next-auth'

// ─── Types ────────────────────────────────────────────────────

type NavItem = {
  label:    string
  href:     string
  icon:     React.ElementType
  badge?:   React.ReactNode
  superOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Queue',
    href:  '/admin/queue',
    icon:  Inbox,
    badge: <QueueBadge />,
  },
  {
    label: 'Restaurants',
    href:  '/admin/restaurants',
    icon:  Building2,
  },
  {
    label: 'Dishes',
    href:  '/admin/dishes',
    icon:  Utensils,
  },
  {
    label: 'Analytics',
    href:  '/admin/analytics',
    icon:  BarChart2,
  },
  {
    label:     'Users',
    href:      '/admin/users',
    icon:      Users,
    superOnly: true,
  },
]

// ─── Nav item ─────────────────────────────────────────────────

function SidebarNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        // Base — §10.5 Admin Sidebar spec
        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium',
        'rounded-none transition-colors duration-[100ms] ease-out',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500',
        // Minimum touch target — §8.5: 48px height for list items
        'min-h-[48px]',
        isActive
          ? // Active: amber-500 left border (3px), neutral-0 text, neutral-800 bg — §10.5
            'border-l-[3px] border-l-amber-500 bg-neutral-800 text-neutral-0 pl-[13px]'
          : // Inactive: neutral-300 text — §10.5
            'border-l-[3px] border-l-transparent text-neutral-300 hover:bg-neutral-800 hover:text-neutral-0',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <item.icon
        size={20}
        strokeWidth={1.5} // §Appendix A — 1.5px stroke, never 2px
        aria-hidden="true"
        className="shrink-0"
      />
      <span className="flex-1">{item.label}</span>
      {item.badge}
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────

type AdminSidebarProps = {
  session: Session | null
}

export function AdminSidebar({ session }: AdminSidebarProps) {
  const pathname  = usePathname()
  const isSuperAdmin = session?.user?.role === 'SUPER'

  const visibleItems = NAV_ITEMS.filter((item) => !item.superOnly || isSuperAdmin)

  // A nav item is active when the pathname starts with its href.
  // This ensures /admin/queue/[id] keeps Queue highlighted.
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    // neutral-950 background — §11.2 Admin color overrides
    // In dark mode, sidebar-bg becomes #0A0907 via --admin-sidebar-bg — §18
    <aside
      className={cn(
        'hidden lg:flex lg:flex-col',
        'w-60 min-h-screen shrink-0',
        'bg-neutral-950',
      )}
      aria-label="Admin navigation"
    >
      {/* Logo area */}
      <div className="flex h-16 items-center px-4 border-b border-neutral-800">
        <Link
          href="/admin/queue"
          className="font-display text-xl font-semibold text-amber-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded"
        >
          Chow Here
        </Link>
        <span className="ml-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4" aria-label="Main navigation">
        <ul role="list" className="space-y-0.5">
          {visibleItems.map((item) => (
            <li key={item.href}>
              <SidebarNavItem item={item} isActive={isActive(item.href)} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer — user info, logout, dark mode toggle */}
      <div className="border-t border-neutral-800 p-4 space-y-3">
        {/* User info */}
        {session?.user && (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-neutral-200 truncate">
              {session.user.name ?? session.user.email}
            </span>
            <span className="text-xs text-neutral-500 capitalize">
              {session.user.role?.toLowerCase()}
            </span>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between">
          {/* Logout */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={cn(
              'inline-flex items-center gap-2 text-sm text-neutral-400',
              'hover:text-neutral-200 transition-colors duration-[100ms] ease-out',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded',
              'py-1',
            )}
          >
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Log out</span>
          </button>

          {/* Dark mode toggle */}
          <DarkModeToggle />
        </div>
      </div>
    </aside>
  )
}

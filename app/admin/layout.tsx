// Admin section layout — wraps all /admin/* pages.
//
// Responsibilities:
//   1. Render AdminSidebar (240px fixed, neutral-950 bg) + main content area
//   2. Apply data-theme="dark" on <html> when isDark is true (§18)
//   3. Set neutral-100 page background for the main content area (§11.2)
//
// Security: This layout does not replace the middleware or route-handler auth checks.
// Layer 1 (middleware.ts) already redirects unauthenticated visitors before this
// layout renders. Layer 2 checks remain in every API route handler. §7.1
//
// Session: read client-side via useSession() — SessionProvider is in app/providers.tsx.
// Dark mode: read from useAdminPrefsStore (Zustand, localStorage-persisted). §18
//
// Design tokens:
//   Sidebar:       neutral-950 (AdminSidebar owns this surface — §10.5, §11.2)
//   Page bg:       var(--admin-bg-page)  neutral-100 light / #1A1714 dark  §11.2 + §18
//   data-theme:    set on document.documentElement, not on a wrapper div     §18

'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAdminPrefsStore } from '@/stores/admin-prefs.store'
import { AdminSidebar } from 'features/admin/components/layout/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const isDark            = useAdminPrefsStore((s) => s.isDark)

  // Apply data-theme="dark" to <html> so the CSS custom property overrides
  // in globals.css §18 take effect. Setting it here (in the admin layout)
  // ensures it is only ever active inside /admin/* routes. §18 Implementation.
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : ''
    return () => {
      // Clean up when navigating away from admin (e.g., sign-out to /login).
      document.documentElement.dataset.theme = ''
    }
  }, [isDark])

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — 240px fixed, neutral-950 background. Hidden below lg. §10.5, §11.2 */}
      <AdminSidebar session={session} />

      {/* Main content — fills remaining width. bg comes from CSS custom property
          so it responds to data-theme="dark" without a separate dark: class. §11.2 §18 */}
      <main
        className="flex-1 min-w-0"
        style={{ background: 'var(--admin-bg-page)' }}
      >
        {children}
      </main>
    </div>
  )
}

// Consumer public layout — route group (public) wraps all public-facing pages:
//   /restaurants/[slug], /restaurants, and future consumer routes.
//
// Responsibilities:
//   1. Set neutral-50 page background (design system §2.1 — color.bg.base)
//   2. Reserve space for the fixed bottom nav on mobile (64px + safe area)
//   3. Render ConsumerBottomNav (visible ≤ lg, hidden on desktop per §9.4)
//
// This layout does NOT replace auth middleware. Public routes in this group
// require no authentication. The middleware.ts Layer 1 gate is already scoped
// to /admin/* routes only.
//
// Governed by: restaurant-listing-track.md §17.3, design-system-v1.md §9.4

import { ConsumerBottomNav } from '@/components/layout/ConsumerBottomNav'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      {/*
        pb-16 on mobile reserves 64px for the fixed bottom nav.
        lg:pb-0 removes the reservation on desktop (no bottom nav).
        min-h ensures the layout fills the viewport even for short pages.
      */}
      <main className="flex-1 pb-16 lg:pb-0">
        {children}
      </main>

      {/* Fixed bottom nav — rendered client-side for usePathname active state */}
      <ConsumerBottomNav />
    </div>
  )
}

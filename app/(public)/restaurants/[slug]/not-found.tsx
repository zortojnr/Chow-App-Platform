// Route-level not-found for /restaurants/[slug].
// Rendered by Next.js when notFound() is called in the page — covers both
// missing restaurants and non-APPROVED restaurants (§5.1 no disclosure).

import Link from 'next/link'
import { UtensilsCrossed } from 'lucide-react'

export default function RestaurantNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <UtensilsCrossed
        size={48}
        strokeWidth={1.5}
        className="text-neutral-300 mb-5"
        aria-hidden="true"
      />
      <h1 className="font-display text-2xl font-bold text-neutral-900 mb-2">
        Restaurant not found
      </h1>
      <p className="text-base text-neutral-500 mb-8 max-w-sm">
        This listing may no longer be available or the link may be incorrect.
      </p>
      <Link
        href="/restaurants"
        className="inline-flex items-center px-5 py-2.5 rounded-full bg-neutral-900 text-neutral-0 text-sm font-semibold hover:bg-neutral-800 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
      >
        Browse all restaurants
      </Link>
    </div>
  )
}

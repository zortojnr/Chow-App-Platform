// Global 404 — shown for any unmatched route.
// Uses the Chow Here brand: Fraunces display, amber CTA, neutral palette.

import Link from 'next/link'
import { Search } from 'lucide-react'

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-neutral-50">
      <p className="text-sm font-semibold text-amber-600 mb-3 tracking-widest uppercase">
        404
      </p>
      <h1 className="font-display text-4xl font-bold text-neutral-900 mb-3">
        Page not found
      </h1>
      <p className="text-base text-neutral-500 mb-8 max-w-sm">
        This page doesn't exist or may have been moved.
      </p>
      <Link
        href="/restaurants"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-neutral-0 text-sm font-semibold hover:bg-amber-600 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-brand"
      >
        <Search size={14} aria-hidden="true" />
        Browse restaurants
      </Link>
    </div>
  )
}

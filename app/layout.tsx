// Root layout — shared across all routes.
// Loads fonts, sets viewport meta, and wraps children in the provider tree.
//
// Fonts (design-system-v1.md §3.1):
//   Fraunces     — display headings, restaurant names, hero text (consumer UI)
//   Plus Jakarta Sans — all UI text (admin and consumer)
//   JetBrains Mono — IDs, scores, reference numbers (admin UI)
//
// Font variables are injected as CSS custom properties on <body>:
//   --font-fraunces, --font-plus-jakarta-sans, --font-jetbrains-mono
// globals.css @theme maps these to --font-display, --font-sans, --font-mono.

import type { Metadata, Viewport } from 'next'
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Providers } from './providers'
import './globals.css'

// ─── Font loading ─────────────────────────────────────────────

const fraunces = Fraunces({
  subsets:  ['latin'],
  variable: '--font-fraunces',
  weight:   ['400', '600', '700'],
  // opsz: optical size (9–144). SOFT: character softness (0=authority, 50=warmth).
  // design-system-v1.md §3.1 — SOFT=0 for editorial, SOFT=50 for conversational.
  axes: ['opsz', 'SOFT'],
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets:  ['latin'],
  variable: '--font-plus-jakarta-sans',
  weight:   ['300', '400', '500', '600', '700'],
  display:  'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-jetbrains-mono',
  weight:   ['400', '500'],
  display:  'swap',
})

// ─── Metadata ─────────────────────────────────────────────────

export const metadata: Metadata = {
  title:       'Chow Here',
  description: 'Trusted dish-first Nigerian food discovery platform.',
}

// design-system-v1.md §9.7 — viewport-fit=cover for notch/home indicator handling
export const viewport: Viewport = {
  width:       'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// ─── Layout ───────────────────────────────────────────────────

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Pre-fetch session server-side to avoid a client-side waterfall.
  const session = await getServerSession(authOptions)

  const fontClasses = [
    fraunces.variable,
    plusJakartaSans.variable,
    jetbrainsMono.variable,
  ].join(' ')

  return (
    <html lang="en">
      <body className={fontClasses}>
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  )
}

'use client'

// Client-side provider tree.
// Wraps all pages with:
//   SessionProvider  — NextAuth session context
//   QueryClientProvider — TanStack Query cache
//   Toaster          — Sonner toast stack (bottom-right desktop, bottom-centre mobile)
//
// QueryClient configuration follows frontend-standards.md §3.2:
//   staleTime 0 by default (data considered stale immediately — individual
//   queries override with their own staleTime as appropriate).
//   Retries: 1 (not 3) to keep error feedback fast for admin workflows.

import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import type { Session } from 'next-auth'

type ProvidersProps = {
  children: React.ReactNode
  session:  Session | null
}

export function Providers({ children, session }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            retry:     1,
            // On 401, stop retrying — the user's session has expired.
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* Toaster: bottom-right desktop, bottom-centre mobile. design-system-v1.md §10.8 */}
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  )
}

// IP extraction from Vercel/Next.js request headers.
//
// Vercel sets x-forwarded-for on all requests. x-real-ip is a fallback
// for other proxy configurations. Falls back to 127.0.0.1 only in tests.
//
// Note: request.ip is not used — it is absent from the NextRequest type in
// Next.js 15 and causes TS errors (Property 'ip' does not exist).
//
// Used by 3+ features (intake, admin verification, photo upload) per
// master-architecture.md §4.3 — shared logic belongs in lib/.

import type { NextRequest } from 'next/server'

export function extractIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip')?.trim() ??
    '127.0.0.1'
  )
}

// Admin route protection middleware.
//
// Governs access to all /admin/* routes. Runs before any page render,
// eliminating the possibility of a flash of protected content.
//
// Security model (three-layer — see admin-platform-track.md §7.1):
//   Layer 1 (this file) — Next.js middleware: redirects on /admin/* before
//     the request reaches a page or layout component.
//   Layer 2 — API route handlers: getServerSession() + requireRole() in every
//     /api/v1/admin/* handler. This layer remains the authoritative gate.
//   Layer 3 — Service layer: actorRole validation within service methods.
//
// Removing this middleware does NOT remove security — Layer 2 stays in place.
// But removing this file does re-enable the flash of protected content.
//
// Uses getToken() from next-auth/jwt (reads the JWT cookie directly, no DB
// call) so it is safe in the Next.js Edge Runtime.
//
// Exported pure helpers (isAdminPath, isAdminRole) exist solely for unit
// testing without needing to construct full NextRequest objects.
//
// Governed by: security-standards.md §3.4, admin-platform-track.md §2.2, §7.1

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// String literals — not imported from @prisma/client — so this module
// remains Edge Runtime compatible. Must stay in sync with the UserRole enum.
const ADMIN_ROLES = new Set(['ADMIN', 'SUPER'])

// Returns true when the given pathname falls under the /admin tree.
// The two-condition check (`=== '/admin'` | `startsWith('/admin/')`) prevents
// false matches against paths like /administration.
export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

// Returns true when the given role value is one that may access /admin/*.
// Accepts `unknown` so tests and the middleware body can pass token.role
// directly without a cast.
export function isAdminRole(role: unknown): boolean {
  return typeof role === 'string' && ADMIN_ROLES.has(role)
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Fast path — non-admin routes pass through immediately without a token read.
  if (!isAdminPath(pathname)) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // No session → redirect to /login with the requested path as callbackUrl.
  // Search params are preserved so active queue filters survive the login round-trip.
  if (!token) {
    const callbackUrl = pathname + (request.nextUrl.search ?? '')
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', callbackUrl)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated but not an admin or super → redirect to home.
  // This handles USER-role sessions that manually navigate to /admin/*.
  // Not redirecting to /login (they are authenticated — wrong role, not
  // unauthenticated) prevents an incorrect "please log in" message.
  if (!isAdminRole(token.role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Next.js route matcher — restricts middleware execution to /admin/* only.
// The runtime still checks isAdminPath() as a belt-and-suspenders guard.
export const config = {
  matcher: ['/admin/:path*'],
}

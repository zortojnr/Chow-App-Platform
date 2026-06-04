// middleware.ts — comprehensive tests
//
// Coverage:
//
//   isAdminPath
//     ✓ /admin (exact match)
//     ✓ /admin/queue
//     ✓ /admin/restaurants/[id]/review
//     ✓ /admin/restaurants/[id]/intelligence
//     ✓ /admin/users
//     ✓ /admin/dishes
//     ✓ /admin/analytics
//     ✓ / — not an admin path
//     ✓ /login — not an admin path
//     ✓ /search — not an admin path
//     ✓ /administration — false prefix match, not an admin path
//     ✓ /api/v1/admin/verification/queue — not matched (API routes guarded separately)
//
//   isAdminRole
//     ✓ ADMIN → true
//     ✓ SUPER → true
//     ✓ USER → false
//     ✓ SYSTEM → false
//     ✓ undefined → false
//     ✓ null → false
//     ✓ empty string → false
//     ✓ number → false
//     ✓ admin (lowercase) → false (case-sensitive)
//
//   middleware — non-admin paths
//     ✓ passes through / without reading the token
//     ✓ passes through /login without reading the token
//     ✓ passes through /search without reading the token
//     ✓ passes through /api/v1/intake/restaurants without reading the token
//
//   middleware — unauthenticated on admin path
//     ✓ redirects when token is null
//     ✓ redirect destination is /login
//     ✓ callbackUrl equals the requested pathname
//     ✓ callbackUrl includes search params when present
//     ✓ /admin (exact) redirects with callbackUrl=/admin
//     ✓ /admin/restaurants/[id]/review redirects with correct callbackUrl
//     ✓ /admin/users redirects with correct callbackUrl
//     ✓ passes NEXTAUTH_SECRET to getToken
//
//   middleware — authenticated, wrong role
//     ✓ USER role redirects to /
//     ✓ SYSTEM role redirects to /
//     ✓ wrong-role redirect goes to / not /login
//     ✓ wrong-role redirect has no callbackUrl
//
//   middleware — ADMIN role
//     ✓ /admin/queue — passes through
//     ✓ /admin/restaurants — passes through
//     ✓ /admin/restaurants/[id]/review — passes through
//     ✓ /admin/restaurants/[id]/intelligence — passes through
//     ✓ /admin/dishes — passes through
//     ✓ /admin/analytics — passes through
//
//   middleware — SUPER role
//     ✓ /admin/users — passes through
//     ✓ /admin/queue — passes through
//     ✓ /admin/restaurants/[id]/review — passes through
//
//   config
//     ✓ matcher contains /admin/:path*

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mock next-auth/jwt before importing the module under test ────────────────

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

import { getToken } from 'next-auth/jwt'
import { isAdminPath, isAdminRole, middleware, config } from './middleware'

const mockGetToken = getToken as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, search = ''): NextRequest {
  return new NextRequest(`http://localhost${pathname}${search}`)
}

function mockToken(role: string) {
  mockGetToken.mockResolvedValue({ id: 'some-id', role })
}

function mockNoToken() {
  mockGetToken.mockResolvedValue(null)
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// isAdminPath
// ─────────────────────────────────────────────────────────────────────────────

describe('isAdminPath', () => {
  it('matches /admin exactly', () => {
    expect(isAdminPath('/admin')).toBe(true)
  })

  it('matches /admin/queue', () => {
    expect(isAdminPath('/admin/queue')).toBe(true)
  })

  it('matches /admin/restaurants/[id]/review', () => {
    expect(isAdminPath('/admin/restaurants/uuid-abc-123/review')).toBe(true)
  })

  it('matches /admin/restaurants/[id]/intelligence', () => {
    expect(isAdminPath('/admin/restaurants/uuid-abc-123/intelligence')).toBe(true)
  })

  it('matches /admin/users', () => {
    expect(isAdminPath('/admin/users')).toBe(true)
  })

  it('matches /admin/dishes', () => {
    expect(isAdminPath('/admin/dishes')).toBe(true)
  })

  it('matches /admin/analytics', () => {
    expect(isAdminPath('/admin/analytics')).toBe(true)
  })

  it('does not match /', () => {
    expect(isAdminPath('/')).toBe(false)
  })

  it('does not match /login', () => {
    expect(isAdminPath('/login')).toBe(false)
  })

  it('does not match /search', () => {
    expect(isAdminPath('/search')).toBe(false)
  })

  it('does not match /administration (false prefix match)', () => {
    // Ensures startsWith('/admin') alone would be wrong — must require /admin/
    expect(isAdminPath('/administration')).toBe(false)
  })

  it('does not match /api/v1/admin/verification/queue (API routes guarded by route handlers)', () => {
    expect(isAdminPath('/api/v1/admin/verification/queue')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isAdminRole
// ─────────────────────────────────────────────────────────────────────────────

describe('isAdminRole', () => {
  it('returns true for ADMIN', () => {
    expect(isAdminRole('ADMIN')).toBe(true)
  })

  it('returns true for SUPER', () => {
    expect(isAdminRole('SUPER')).toBe(true)
  })

  it('returns false for USER', () => {
    expect(isAdminRole('USER')).toBe(false)
  })

  it('returns false for SYSTEM', () => {
    // SYSTEM is an actor-only role — never assigned to a User
    expect(isAdminRole('SYSTEM')).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isAdminRole(undefined)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isAdminRole(null)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isAdminRole('')).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isAdminRole(42)).toBe(false)
  })

  it('is case-sensitive — admin (lowercase) returns false', () => {
    expect(isAdminRole('admin')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// middleware — non-admin paths pass through without touching the token
// ─────────────────────────────────────────────────────────────────────────────

describe('middleware — non-admin paths', () => {
  it('passes through / without calling getToken', async () => {
    const res = await middleware(makeRequest('/'))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /login without calling getToken', async () => {
    const res = await middleware(makeRequest('/login'))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /search without calling getToken', async () => {
    const res = await middleware(makeRequest('/search'))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /api/v1/intake/restaurants without calling getToken', async () => {
    const res = await middleware(makeRequest('/api/v1/intake/restaurants'))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// middleware — unauthenticated user on an admin path
// ─────────────────────────────────────────────────────────────────────────────

describe('middleware — unauthenticated on admin path', () => {
  beforeEach(() => {
    mockNoToken()
  })

  it('issues a redirect when no token is present', async () => {
    const res = await middleware(makeRequest('/admin/queue'))
    expect(res.status).toBe(307)
  })

  it('redirect destination is /login', async () => {
    const res = await middleware(makeRequest('/admin/queue'))
    const location = res.headers.get('location')!
    expect(new URL(location).pathname).toBe('/login')
  })

  it('callbackUrl equals the requested pathname', async () => {
    const res = await middleware(makeRequest('/admin/queue'))
    const location = res.headers.get('location')!
    const callbackUrl = new URL(location).searchParams.get('callbackUrl')
    expect(callbackUrl).toBe('/admin/queue')
  })

  it('callbackUrl includes search params when present', async () => {
    const res = await middleware(makeRequest('/admin/queue', '?status=NEEDS_INFO&city=Lagos'))
    const location = res.headers.get('location')!
    const callbackUrl = new URL(location).searchParams.get('callbackUrl')
    expect(callbackUrl).toBe('/admin/queue?status=NEEDS_INFO&city=Lagos')
  })

  it('redirects /admin (exact path) with callbackUrl=/admin', async () => {
    const res = await middleware(makeRequest('/admin'))
    const location = res.headers.get('location')!
    expect(new URL(location).pathname).toBe('/login')
    expect(new URL(location).searchParams.get('callbackUrl')).toBe('/admin')
  })

  it('produces correct callbackUrl for /admin/restaurants/[id]/review', async () => {
    const res = await middleware(makeRequest('/admin/restaurants/some-uuid/review'))
    const location = res.headers.get('location')!
    const callbackUrl = new URL(location).searchParams.get('callbackUrl')
    expect(callbackUrl).toBe('/admin/restaurants/some-uuid/review')
  })

  it('produces correct callbackUrl for /admin/users', async () => {
    const res = await middleware(makeRequest('/admin/users'))
    const location = res.headers.get('location')!
    expect(new URL(location).searchParams.get('callbackUrl')).toBe('/admin/users')
  })

  it('passes NEXTAUTH_SECRET to getToken', async () => {
    const original = process.env.NEXTAUTH_SECRET
    process.env.NEXTAUTH_SECRET = 'test-secret-value'

    const req = makeRequest('/admin/queue')
    await middleware(req)

    expect(mockGetToken).toHaveBeenCalledWith(
      expect.objectContaining({ secret: 'test-secret-value' })
    )

    process.env.NEXTAUTH_SECRET = original
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// middleware — authenticated but wrong role
// ─────────────────────────────────────────────────────────────────────────────

describe('middleware — authenticated, wrong role', () => {
  it('redirects USER role to /', async () => {
    mockToken('USER')
    const res = await middleware(makeRequest('/admin/queue'))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(new URL(location).pathname).toBe('/')
  })

  it('redirects SYSTEM role to /', async () => {
    mockToken('SYSTEM')
    const res = await middleware(makeRequest('/admin/queue'))
    const location = res.headers.get('location')!
    expect(new URL(location).pathname).toBe('/')
  })

  it('wrong-role redirect goes to / not /login (authenticated, not unauthenticated)', async () => {
    mockToken('USER')
    const res = await middleware(makeRequest('/admin/queue'))
    const location = res.headers.get('location')!
    expect(new URL(location).pathname).not.toBe('/login')
  })

  it('wrong-role redirect carries no callbackUrl', async () => {
    mockToken('USER')
    const res = await middleware(makeRequest('/admin/queue'))
    const location = res.headers.get('location')!
    expect(new URL(location).searchParams.get('callbackUrl')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// middleware — ADMIN role passes through
// ─────────────────────────────────────────────────────────────────────────────

describe('middleware — ADMIN role', () => {
  beforeEach(() => {
    mockToken('ADMIN')
  })

  it('passes through /admin/queue', async () => {
    const res = await middleware(makeRequest('/admin/queue'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /admin/restaurants', async () => {
    const res = await middleware(makeRequest('/admin/restaurants'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /admin/restaurants/[id]/review', async () => {
    const res = await middleware(makeRequest('/admin/restaurants/uuid-abc/review'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /admin/restaurants/[id]/intelligence', async () => {
    const res = await middleware(makeRequest('/admin/restaurants/uuid-abc/intelligence'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /admin/dishes', async () => {
    const res = await middleware(makeRequest('/admin/dishes'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /admin/analytics', async () => {
    const res = await middleware(makeRequest('/admin/analytics'))
    expect(res.headers.get('location')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// middleware — SUPER role passes through
// ─────────────────────────────────────────────────────────────────────────────

describe('middleware — SUPER role', () => {
  beforeEach(() => {
    mockToken('SUPER')
  })

  it('passes through /admin/users', async () => {
    const res = await middleware(makeRequest('/admin/users'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /admin/queue', async () => {
    const res = await middleware(makeRequest('/admin/queue'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through /admin/restaurants/[id]/review', async () => {
    const res = await middleware(makeRequest('/admin/restaurants/uuid-xyz/review'))
    expect(res.headers.get('location')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// config
// ─────────────────────────────────────────────────────────────────────────────

describe('config', () => {
  it('matcher includes /admin/:path* to activate middleware on admin routes', () => {
    expect(config.matcher).toContain('/admin/:path*')
  })
})

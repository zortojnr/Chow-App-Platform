// lib/auth.ts — comprehensive tests
//
// Coverage goals:
//   hashPassword
//     ✓ Returns a valid bcrypt hash string ($2b$ prefix)
//     ✓ Two calls with the same input produce different hashes (random salt)
//     ✓ Result is verifiable with bcrypt.compare
//     ✓ Uses BCRYPT_COST = 12 (hash encodes the cost factor)
//
//   verifyPassword
//     ✓ Correct password returns true
//     ✓ Wrong password returns false
//     ✓ Empty password returns false
//     ✓ Non-bcrypt string as hash returns false (no throw)
//     ✓ Empty hash returns false (no throw)
//
//   requireRole
//     ✓ Matching role does not throw
//     ✓ Non-matching role throws ForbiddenError
//     ✓ Multiple roles in list — matching role passes
//     ✓ Multiple roles in list — non-matching role throws
//     ✓ SUPER in ['ADMIN', 'SUPER'] passes
//     ✓ USER in ['ADMIN', 'SUPER'] throws
//     ✓ Thrown error has statusCode 403
//
//   authorizeUser
//     ✓ Empty email returns null
//     ✓ Empty password returns null
//     ✓ User not found returns null
//     ✓ User found but isActive = false returns null
//     ✓ User found, active, wrong password returns null
//     ✓ User found, active, correct password returns AuthorizedUser
//     ✓ Returned object has id, email, name, role — no passwordHash
//     ✓ displayName null → name is null in returned user
//
//   authOptions shape
//     ✓ session.strategy === 'jwt'
//     ✓ session.maxAge === 86400 (24 hours)
//     ✓ Exactly one provider defined
//     ✓ signIn page is '/login'
//
//   jwt callback
//     ✓ First sign-in: token receives id and role from user
//     ✓ Subsequent calls without user: token unchanged
//
//   session callback
//     ✓ session.user.id populated from token
//     ✓ session.user.role populated from token

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'
import {
  hashPassword,
  verifyPassword,
  requireRole,
  authorizeUser,
  authOptions,
  BCRYPT_COST,
  type AuthorizedUser,
} from './auth'
import { ForbiddenError } from './errors'
import type { Session } from 'next-auth'

// ─── Mock: @/lib/db ───────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
const mockFindFirst = db.user.findFirst as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: UserRole): Session {
  return {
    user: { id: 'user-id', email: 'test@example.com', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  }
}

function makeDbUser(overrides: Partial<{
  id: string
  email: string
  displayName: string | null
  passwordHash: string
  role: UserRole
  isActive: boolean
}> = {}) {
  return {
    id:           'user-id-1',
    email:        'admin@chowhere.com',
    displayName:  'Test Admin',
    passwordHash: '',        // overwritten per test
    role:         UserRole.ADMIN,
    isActive:     true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────
// hashPassword
// ─────────────────────────────────────────────────────────────

describe('hashPassword', () => {
  it('returns a valid bcrypt hash string ($2a$ or $2b$ prefix)', async () => {
    const hash = await hashPassword('TestPass1')
    expect(hash).toMatch(/^\$2[ab]\$/)
  })

  it('encodes the configured cost factor', async () => {
    const hash = await hashPassword('TestPass1')
    expect(hash).toContain(`$${BCRYPT_COST}$`)
  })

  it('two calls with the same input produce different hashes (random salt)', async () => {
    const [h1, h2] = await Promise.all([
      hashPassword('SamePass1'),
      hashPassword('SamePass1'),
    ])
    expect(h1).not.toBe(h2)
  })

  it('result is verifiable with verifyPassword', async () => {
    const hash = await hashPassword('Verifiable1')
    expect(await verifyPassword('Verifiable1', hash)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// verifyPassword
// ─────────────────────────────────────────────────────────────

describe('verifyPassword', () => {
  let validHash: string

  beforeAll(async () => {
    validHash = await hashPassword('CorrectPass1')
  })

  it('returns true for the correct password', async () => {
    expect(await verifyPassword('CorrectPass1', validHash)).toBe(true)
  })

  it('returns false for the wrong password', async () => {
    expect(await verifyPassword('WrongPass1', validHash)).toBe(false)
  })

  it('returns false for an empty password', async () => {
    expect(await verifyPassword('', validHash)).toBe(false)
  })

  it('returns false (does not throw) for a non-bcrypt hash string', async () => {
    await expect(verifyPassword('AnyPassword1', 'not-a-bcrypt-hash')).resolves.toBe(false)
  })

  it('returns false (does not throw) for an empty hash string', async () => {
    await expect(verifyPassword('AnyPassword1', '')).resolves.toBe(false)
  })

  it('returns false (does not throw) for a placeholder-style string', async () => {
    await expect(verifyPassword('AnyPassword1', '!!SETUP_PENDING!!')).resolves.toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────────────────────

describe('requireRole', () => {
  it('does not throw when session role matches the required role', () => {
    expect(() =>
      requireRole(makeSession(UserRole.ADMIN), [UserRole.ADMIN])
    ).not.toThrow()
  })

  it('throws ForbiddenError when session role does not match', () => {
    expect(() =>
      requireRole(makeSession(UserRole.USER), [UserRole.ADMIN])
    ).toThrow(ForbiddenError)
  })

  it('passes when session role is in a multi-role list', () => {
    expect(() =>
      requireRole(makeSession(UserRole.SUPER), [UserRole.ADMIN, UserRole.SUPER])
    ).not.toThrow()
  })

  it('passes when ADMIN is in [ADMIN, SUPER]', () => {
    expect(() =>
      requireRole(makeSession(UserRole.ADMIN), [UserRole.ADMIN, UserRole.SUPER])
    ).not.toThrow()
  })

  it('throws when USER role is presented against [ADMIN, SUPER]', () => {
    expect(() =>
      requireRole(makeSession(UserRole.USER), [UserRole.ADMIN, UserRole.SUPER])
    ).toThrow(ForbiddenError)
  })

  it('throws when SUPER-only endpoint receives ADMIN role', () => {
    expect(() =>
      requireRole(makeSession(UserRole.ADMIN), [UserRole.SUPER])
    ).toThrow(ForbiddenError)
  })

  it('thrown ForbiddenError has statusCode 403', () => {
    let caught: unknown
    try {
      requireRole(makeSession(UserRole.USER), [UserRole.ADMIN])
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ForbiddenError)
    expect((caught as ForbiddenError).statusCode).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────
// authorizeUser
// ─────────────────────────────────────────────────────────────

describe('authorizeUser — missing credentials', () => {
  it('returns null for empty email', async () => {
    expect(await authorizeUser('', 'SomePass1')).toBeNull()
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns null for empty password', async () => {
    expect(await authorizeUser('admin@test.com', '')).toBeNull()
    expect(mockFindFirst).not.toHaveBeenCalled()
  })
})

describe('authorizeUser — user lookup failures', () => {
  it('returns null when user is not found', async () => {
    mockFindFirst.mockResolvedValue(null)
    expect(await authorizeUser('nobody@test.com', 'SomePass1')).toBeNull()
  })

  it('returns null when user is found but isActive = false', async () => {
    mockFindFirst.mockResolvedValue(
      makeDbUser({ isActive: false, passwordHash: await hashPassword('SomePass1') })
    )
    expect(await authorizeUser('admin@test.com', 'SomePass1')).toBeNull()
  })
})

describe('authorizeUser — credential validation', () => {
  let correctHash: string

  beforeAll(async () => {
    correctHash = await hashPassword('ValidPass1')
  })

  it('returns null when password is wrong', async () => {
    mockFindFirst.mockResolvedValue(makeDbUser({ passwordHash: correctHash }))
    expect(await authorizeUser('admin@test.com', 'WrongPass1')).toBeNull()
  })

  it('returns AuthorizedUser on valid credentials', async () => {
    const dbUser = makeDbUser({
      id:           'uuid-abc-123',
      email:        'admin@chowhere.com',
      displayName:  'Admin User',
      passwordHash: correctHash,
      role:         UserRole.ADMIN,
      isActive:     true,
    })
    mockFindFirst.mockResolvedValue(dbUser)

    const result = await authorizeUser('admin@chowhere.com', 'ValidPass1')

    expect(result).toEqual<AuthorizedUser>({
      id:    'uuid-abc-123',
      email: 'admin@chowhere.com',
      name:  'Admin User',
      role:  UserRole.ADMIN,
    })
  })

  it('does not include passwordHash in the returned object', async () => {
    mockFindFirst.mockResolvedValue(makeDbUser({ passwordHash: correctHash }))
    const result = await authorizeUser('admin@test.com', 'ValidPass1')
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('returns name as null when displayName is null', async () => {
    mockFindFirst.mockResolvedValue(
      makeDbUser({ displayName: null, passwordHash: correctHash })
    )
    const result = await authorizeUser('admin@test.com', 'ValidPass1')
    expect(result?.name).toBeNull()
  })

  it('returns SUPER role correctly', async () => {
    mockFindFirst.mockResolvedValue(
      makeDbUser({ role: UserRole.SUPER, passwordHash: correctHash })
    )
    const result = await authorizeUser('super@test.com', 'ValidPass1')
    expect(result?.role).toBe(UserRole.SUPER)
  })

  it('queries the db with the provided email', async () => {
    mockFindFirst.mockResolvedValue(null)
    await authorizeUser('specific@test.com', 'SomePass1')
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: 'specific@test.com' }),
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────
// authOptions shape
// ─────────────────────────────────────────────────────────────

describe('authOptions shape', () => {
  it('uses jwt session strategy', () => {
    expect(authOptions.session?.strategy).toBe('jwt')
  })

  it('session maxAge is 86400 seconds (24 hours)', () => {
    expect(authOptions.session?.maxAge).toBe(86_400)
  })

  it('defines exactly one provider', () => {
    expect(authOptions.providers).toHaveLength(1)
  })

  it('redirects to /login for sign-in', () => {
    expect(authOptions.pages?.signIn).toBe('/login')
  })
})

// ─────────────────────────────────────────────────────────────
// jwt callback
// ─────────────────────────────────────────────────────────────

describe('jwt callback', () => {
  const jwtCallback = authOptions.callbacks?.jwt

  it('adds id and role to token on first sign-in', async () => {
    const user = { id: 'user-id-1', email: 'a@b.com', role: UserRole.ADMIN }
    const token = {}
    const result = await jwtCallback!({ token, user } as Parameters<typeof jwtCallback>[0])
    expect(result.id).toBe('user-id-1')
    expect(result.role).toBe(UserRole.ADMIN)
  })

  it('does not modify token when user is absent (subsequent requests)', async () => {
    const token = { id: 'existing-id', role: UserRole.SUPER, sub: 'x' }
    const result = await jwtCallback!({ token } as Parameters<typeof jwtCallback>[0])
    expect(result.id).toBe('existing-id')
    expect(result.role).toBe(UserRole.SUPER)
  })
})

// ─────────────────────────────────────────────────────────────
// session callback
// ─────────────────────────────────────────────────────────────

describe('session callback', () => {
  const sessionCallback = authOptions.callbacks?.session

  it('populates session.user.id from token', async () => {
    const token   = { id: 'token-user-id', role: UserRole.ADMIN, sub: 'x' }
    const session = makeSession(UserRole.ADMIN)
    const result  = await sessionCallback!({ session, token } as Parameters<typeof sessionCallback>[0])
    expect(result.user.id).toBe('token-user-id')
  })

  it('populates session.user.role from token', async () => {
    const token   = { id: 'any-id', role: UserRole.SUPER, sub: 'x' }
    const session = makeSession(UserRole.ADMIN)
    const result  = await sessionCallback!({ session, token } as Parameters<typeof sessionCallback>[0])
    expect(result.user.role).toBe(UserRole.SUPER)
  })
})

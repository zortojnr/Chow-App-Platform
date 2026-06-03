// Authentication utilities and NextAuth configuration.
//
// Exports:
//   authOptions        — NextAuth options; pass to getServerSession() in route handlers
//   requireRole()      — throws ForbiddenError if session role is not in the allowed list
//   hashPassword()     — bcrypt hash at cost 12; use for new passwords and setup placeholders
//   verifyPassword()   — bcrypt compare; returns false (not throw) on malformed hashes
//   authorizeUser()    — testable core of the CredentialsProvider authorize callback
//
// Governed by: security-standards.md §1, §2, §3; admin-platform-track.md §2.3, §7.4

import bcrypt from 'bcryptjs'
import type { NextAuthOptions, Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { ForbiddenError } from '@/lib/errors'

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

// security-standards.md §2.1 — cost 12 is the required minimum
export const BCRYPT_COST = 12 as const

// ─────────────────────────────────────────────────────────────
// PASSWORD UTILITIES
// ─────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

// Returns false (never throws) when hashed is not a valid bcrypt string.
// This guards against malformed placeholder hashes reaching bcrypt internals.
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hashed)
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// ROLE ENFORCEMENT
// ─────────────────────────────────────────────────────────────

// Throws ForbiddenError if the session user's role is not in the allowed list.
// security-standards.md §3.3 Rule 1 — call this in every admin route handler.
export function requireRole(session: Session, roles: UserRole[]): void {
  if (!roles.includes(session.user.role as UserRole)) {
    throw new ForbiddenError()
  }
}

// ─────────────────────────────────────────────────────────────
// AUTHORIZE LOGIC
// ─────────────────────────────────────────────────────────────

export type AuthorizedUser = {
  id:    string
  email: string
  name:  string | null
  role:  UserRole
}

// Core credential validation logic, extracted for testability.
// Called by the CredentialsProvider authorize callback below.
//
// Returns null on any failure — NextAuth interprets null as "rejected".
// Guards:
//   1. Both email and password must be non-empty strings
//   2. User must exist and not be soft-deleted (db withSoftDelete injects deletedAt: null)
//   3. isActive must be true — accounts awaiting setup or deactivated accounts are blocked
//   4. Password must match the stored hash
export async function authorizeUser(
  email: string,
  password: string,
): Promise<AuthorizedUser | null> {
  if (!email || !password) return null

  const user = await db.user.findFirst({
    where: { email },
    select: {
      id:           true,
      email:        true,
      displayName:  true,
      passwordHash: true,
      role:         true,
      isActive:     true,
    },
  })

  if (!user)           return null
  if (!user.isActive)  return null

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null

  return {
    id:    user.id,
    email: user.email,
    name:  user.displayName ?? null,
    role:  user.role,
  }
}

// ─────────────────────────────────────────────────────────────
// NEXTAUTH OPTIONS
// ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        email:    { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        return authorizeUser(credentials.email, credentials.password)
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours — all roles; security-standards.md §1.2
  },

  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on the initial sign-in
      if (user) {
        token.id   = user.id
        token.role = (user as AuthorizedUser).role
      }
      return token
    },

    async session({ session, token }) {
      session.user.id   = token.id
      session.user.role = token.role
      return session
    },
  },

  pages: {
    signIn: '/login',
  },
}

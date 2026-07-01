// Account Service — Track 5 §4.2
//
// Self-service public registration. Unlike restaurant intake, there is no
// admin approval step — accounts are usable immediately (see track-05 §8.2
// for why emailVerified does not gate login in Phase 1).
//
// Governed by: track-05-user-accounts.md §4.2, §8.2

import { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { ConflictError } from '@/lib/errors'
import type { RegisterInput } from '../schemas/register.schema'

export const AccountService = {
  async register({ email, password, displayName }: RegisterInput): Promise<{ id: string }> {
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) throw new ConflictError('An account with this email already exists')

    const passwordHash = await hashPassword(password)

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.USER,
        displayName: displayName ?? null,
      },
      select: { id: true },
    })

    return user
  },
}

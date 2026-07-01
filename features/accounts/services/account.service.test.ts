// Account Service — unit tests
//
// DB and hashPassword are mocked. Covers registration success and the
// duplicate-email conflict path.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountService } from './account.service'
import { ConflictError } from '@/lib/errors'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(async () => 'hashed-password'),
}))

import { db } from '@/lib/db'
const mockDb = db as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AccountService.register', () => {
  it('creates a USER-role account with a hashed password', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({ id: 'user-uuid-001' })

    const result = await AccountService.register({
      email: 'new@example.com',
      password: 'plaintext-password',
    })

    expect(result).toEqual({ id: 'user-uuid-001' })
    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: {
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        role: 'USER',
        displayName: null,
      },
      select: { id: true },
    })
  })

  it('throws ConflictError when the email is already registered', async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: 'existing-user' })

    await expect(
      AccountService.register({ email: 'taken@example.com', password: 'plaintext-password' }),
    ).rejects.toThrow(ConflictError)
    expect(mockDb.user.create).not.toHaveBeenCalled()
  })
})

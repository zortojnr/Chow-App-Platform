// Registration validation schema — Track 5 §4.2
//
// Password policy mirrors bcrypt's own practical input limit and the
// existing hashPassword()/verifyPassword() in src/lib/auth.ts — no new
// hashing logic is introduced here, only shape validation.
//
// Governed by: track-05-user-accounts.md §4.2

import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer'),
  displayName: z.string().trim().min(1).max(100).optional(),
})

export type RegisterInput = z.infer<typeof RegisterSchema>

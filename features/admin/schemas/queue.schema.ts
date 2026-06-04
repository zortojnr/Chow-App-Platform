// Zod schema for the admin verification queue query parameters.
//
// All parameters arrive as query strings (strings); z.coerce.number() handles
// the page/limit conversion. Enum values are validated against Prisma's
// VerificationStatus to prevent arbitrary status strings reaching the DB.
//
// Governed by: track-02-verification-intelligence.md §9.3
//              backend-standards.md §3.4 (pagination), §4.2 (schemas)

import { z } from 'zod'
import { VerificationStatus } from '@prisma/client'

export const QueueQuerySchema = z.object({
  // Filter by verification status; defaults to the primary admin workflow view
  status: z
    .nativeEnum(VerificationStatus)
    .optional()
    .default(VerificationStatus.PENDING_REVIEW),

  // Filter by city (Restaurant.city); case-sensitive match
  city: z.string().trim().min(1).max(100).optional(),

  // Filter by assignment:
  //   "me"         → resolve to the requesting admin's ID in the route handler
  //   UUID         → filter by a specific admin's ID
  //   "unassigned" → only unassigned records
  //   absent       → no assignment filter
  assignedTo: z
    .union([z.string().uuid(), z.literal('me'), z.literal('unassigned')])
    .optional(),

  // Sort order by VerificationRecord.createdAt
  sort: z.enum(['oldest', 'newest']).optional().default('oldest'),

  // Offset pagination — backend-standards.md §3.4
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type QueueQueryInput = z.infer<typeof QueueQuerySchema>

// Zod schemas for admin intelligence collection API endpoints.
//
// These schemas validate the bodies of:
//   PATCH /admin/restaurants/:id/dishes/:dishId/verify
//   PATCH /admin/restaurants/:id/photos/:photoId/verify
//   PATCH /admin/restaurants/:id/intelligence
//
// Forbidden restaurant fields (name, slug, city, state, verificationStatus)
// are absent from IntelligenceUpdateSchema — they are not writable via this API.
// track-02-verification-intelligence.md §9.4, §11.1
//
// Governed by: backend-standards.md §4.2, §4.3

import { z } from 'zod'
import { DishAvailabilityStatus, PriceRange } from '@prisma/client'

// ─────────────────────────────────────────────────────────────
// DISH VERIFICATION
// ─────────────────────────────────────────────────────────────

export const VerifyDishSchema = z.object({
  verifiedAt:         z.string().datetime().optional(),
  nameAsServed:       z.string().trim().min(1).max(150).optional(),
  availabilityStatus: z.nativeEnum(DishAvailabilityStatus).optional(),
  price:              z.number().positive().optional(),
})

export type VerifyDishInput = z.infer<typeof VerifyDishSchema>

// ─────────────────────────────────────────────────────────────
// PHOTO VERIFICATION
// ─────────────────────────────────────────────────────────────

export const VerifyPhotoSchema = z.object({
  isVerified: z.boolean(),
  isPrimary:  z.boolean().optional(),
})

export type VerifyPhotoInput = z.infer<typeof VerifyPhotoSchema>

// ─────────────────────────────────────────────────────────────
// RESTAURANT INTELLIGENCE UPDATE
// ─────────────────────────────────────────────────────────────
// All fields are optional (PATCH semantics). At least one must be present.
// Nullable fields (email, website, area, description) accept null to clear values.

export const IntelligenceUpdateSchema = z
  .object({
    description: z.string().trim().max(500).nullable().optional(),
    phone:       z.string().trim().max(20).optional(),
    email:       z.string().email().trim().max(150).nullable().optional(),
    website:     z.string().url().trim().max(300).nullable().optional(),
    priceRange:  z.nativeEnum(PriceRange).optional(),
    area:        z.string().trim().max(100).nullable().optional(),
  })
  .refine(
    (obj) => Object.values(obj).some((v) => v !== undefined),
    { message: 'At least one field must be provided for update' },
  )

export type IntelligenceUpdateInput = z.infer<typeof IntelligenceUpdateSchema>

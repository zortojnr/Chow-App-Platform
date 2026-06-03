// Restaurant Intake Validation Schema
//
// Server-side Zod schema for the intake submission. Mirrors the shape defined in
// restaurant-intake-track.md §3.1–3.2. The Zod schema is authoritative for type
// inference — keep it in sync with the track document.
//
// Dish-ID existence and cuisine-type sanitization are enforced in intake.service.ts,
// not here — those require a DB call that belongs in the service layer.
//
// Governed by: restaurant-intake-track.md §3, backend-standards.md §2.2

import { z } from 'zod'
import { NIGERIAN_CITY_NAMES, NIGERIAN_STATE_NAMES } from './nigeria'

// Nigerian mobile phone: +2347XXXXXXXX / +2348XXXXXXXX / +2349XXXXXXXX
//                         07XXXXXXXXX  / 08XXXXXXXXX  / 09XXXXXXXXX
const NIGERIAN_PHONE_RE = /^(\+?234|0)[789][01]\d{8}$/

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

export const DishEntrySchema = z.object({
  dishId: z.string().uuid('Dish ID must be a valid UUID'),
  nameAsServed: z.string().trim().max(150).optional(),
  description: z.string().trim().max(300).optional(),
  price: z.number().positive('Price must be a positive number').max(99999.99).optional(),
  availabilityStatus: z.enum([
    'ALWAYS_AVAILABLE',
    'SEASONAL',
    'WEEKEND_ONLY',
    'ON_ORDER',
    'UNKNOWN',
  ]),
})

export const PhotoEntrySchema = z.object({
  cloudinaryPublicId: z.string().min(1, 'Cloudinary public ID is required'),
  isPrimary: z.boolean(),
})

// Used by the photo upload route (POST /api/v1/intake/photos)
export const PhotoUploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png'], {
    errorMap: () => ({ message: 'Only JPEG and PNG files are accepted' }),
  }),
  size: z.number().int().positive().max(5 * 1024 * 1024, 'File must not exceed 5MB'),
})

// ─── Main schema ─────────────────────────────────────────────────────────────

export const IntakeSubmissionSchema = z
  .object({
    // Step 1: Restaurant Identity
    name: z
      .string()
      .trim()
      .min(2, 'Restaurant name must be at least 2 characters')
      .max(150, 'Restaurant name must be 150 characters or fewer'),
    description: z.string().trim().max(500).optional(),
    address: z
      .string()
      .trim()
      .min(5, 'Address must be at least 5 characters')
      .max(300),
    city: z.enum(NIGERIAN_CITY_NAMES, {
      errorMap: () => ({ message: 'City must be a recognised Nigerian city' }),
    }),
    state: z.enum(NIGERIAN_STATE_NAMES, {
      errorMap: () => ({ message: 'State must be a recognised Nigerian state' }),
    }),
    area: z.string().trim().max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(
        NIGERIAN_PHONE_RE,
        'Must be a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)',
      ),
    email: z.string().trim().email('Must be a valid email address').optional(),
    website: z.string().trim().url('Must be a valid URL').optional(),
    priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE'], {
      errorMap: () => ({ message: 'Price range must be BUDGET, MID, or UPSCALE' }),
    }),
    cuisineTypes: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Cuisine type cannot be empty')
          .max(50, 'Each cuisine type must be 50 characters or fewer'),
      )
      .min(1, 'At least one cuisine type is required')
      .max(5, 'At most 5 cuisine types are allowed'),

    // Step 2: Dishes
    dishes: z
      .array(DishEntrySchema)
      .min(1, 'At least one dish is required')
      .max(50, 'At most 50 dishes are allowed'),

    // Step 3: Photos (optional — submitted as pre-uploaded Cloudinary IDs)
    photos: z
      .array(PhotoEntrySchema)
      .max(5, 'At most 5 photos are allowed')
      .default([]),

    // Submitter identity (optional)
    submitterName: z.string().trim().max(100).optional(),
    submitterEmail: z
      .string()
      .trim()
      .email('Must be a valid email address')
      .optional(),
    submitterNote: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => data.photos.filter((p) => p.isPrimary).length <= 1,
    {
      message: 'At most one photo may be marked as primary',
      path: ['photos'],
    },
  )

// ─── Derived types ───────────────────────────────────────────────────────────

export type IntakeSubmission = z.infer<typeof IntakeSubmissionSchema>
export type DishEntry = z.infer<typeof DishEntrySchema>
export type PhotoEntry = z.infer<typeof PhotoEntrySchema>

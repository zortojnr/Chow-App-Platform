// Intelligence Collection Service
//
// Governs all admin-driven enrichment of restaurant, dish, and photo data
// collected during and after verification.
//
// Responsibilities:
//   - verifyDish           — set RestaurantDish.verifiedAt + optional field updates
//   - verifyPhoto          — set RestaurantPhoto.isVerified / isPrimary
//   - updateAvailability   — update RestaurantDish.availabilityStatus
//   - updatePricing        — update RestaurantDish.price
//   - recalculateRestaurantIntelligence — update allowed Restaurant fields + recalculate score
//   - overrideScore        — SUPER-only manual confidence score override
//
// Score recalculation triggers (track-02 §6.4):
//   - verifyDish          → FIELD_UPDATED   (verifiedAt does not change score signals
//                                            but recalculation keeps both score columns in sync)
//   - verifyPhoto         → PHOTO_VERIFIED  (only when isVerified actually changes)
//   - recalculateRestaurantIntelligence → FIELD_UPDATED (phone/description/email/website affect score)
//   - updateAvailability  → no recalculation (availability not in score signals)
//   - updatePricing       → no recalculation (price not in score signals)
//
// Audit: structured application log entries only (§8.3).
// No VerificationEvent records — those are exclusive to verification.service.ts.
//
// Table ownership (track-02 §11.1):
//   - RestaurantDish   — Update (verifiedAt, availabilityStatus, price, nameAsServed)
//   - RestaurantPhoto  — Update (isVerified, isPrimary)
//   - Restaurant       — Update (description, phone, area, priceRange, email, website)
//   - FORBIDDEN        — verificationStatus, name, slug, city, state (enforced by type)
//
// DB client: `db` (standard client). Never `dbForVerification` — this service
// does not touch verificationStatus.
//
// Governed by: track-02-verification-intelligence.md §6, §8.3, §9.4, §11.1

import { DishAvailabilityStatus, PriceRange, UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { NotFoundError, ValidationError } from '@/lib/errors'
import {
  calculateScore,
  validateOverrideRequest,
  buildOverrideBreakdown,
  type RestaurantScoreInput,
  type SignalBreakdown,
} from './confidence-score.service'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type VerifyDishParams = {
  restaurantDishId: string
  adminId:          string
  verifiedAt?:      Date
  nameAsServed?:    string
}

export type VerifyDishResult = {
  restaurantDishId: string
  restaurantId:     string
  verifiedAt:       Date
  newScore:         number
}

export type VerifyPhotoParams = {
  photoId:     string
  adminId:     string
  isVerified:  boolean
  isPrimary?:  boolean
}

export type VerifyPhotoResult = {
  photoId:     string
  restaurantId: string
  isVerified:  boolean
  isPrimary:   boolean
  newScore:    number
}

export type UpdateAvailabilityParams = {
  restaurantDishId:   string
  adminId:            string
  availabilityStatus: DishAvailabilityStatus
}

export type UpdatePricingParams = {
  restaurantDishId: string
  adminId:          string
  price:            number
}

export type UpdateIntelligenceFields = {
  description?: string | null
  phone?:       string
  email?:       string | null
  website?:     string | null
  priceRange?:  PriceRange
  area?:        string | null
}

export type UpdateIntelligenceParams = {
  restaurantId: string
  adminId:      string
  fields:       UpdateIntelligenceFields
}

export type UpdateIntelligenceResult = {
  restaurantId: string
  newScore:     number
}

export type OverrideScoreParams = {
  restaurantId: string
  actorId:      string
  actorRole:    UserRole
  score:        number
  reason:       string
}

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

async function fetchRestaurantForScoring(restaurantId: string) {
  return db.restaurant.findFirst({
    where:   { id: restaurantId },
    include: {
      verification: true,
      dishes:  { where: { deletedAt: null } },
      photos:  { where: { isVerified: true } },
    },
  })
}

function buildScoreInput(
  restaurant: NonNullable<Awaited<ReturnType<typeof fetchRestaurantForScoring>>>,
  overrides: { verifiedPhotoCount?: number; activeDishCount?: number } = {},
): RestaurantScoreInput {
  return {
    phone:              restaurant.phone,
    description:        restaurant.description,
    address:            restaurant.address,
    website:            restaurant.website,
    email:              restaurant.email,
    verificationStatus: restaurant.verificationStatus,
    verifiedPhotoCount: overrides.verifiedPhotoCount ?? restaurant.photos.length,
    activeDishCount:    overrides.activeDishCount    ?? restaurant.dishes.length,
  }
}

function logAudit(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ ...entry, timestamp: new Date().toISOString() }))
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export const IntelligenceService = {

  // ── verifyDish ───────────────────────────────────────────
  // Sets RestaurantDish.verifiedAt (confirming dish is genuinely served).
  // Optionally corrects nameAsServed at the same time.
  // Triggers score recalculation per track-02 §6.4 — trigger: FIELD_UPDATED.
  //
  // Note: verifiedAt does not affect any current score signal (S3 counts active
  // dishes regardless of verification). Recalculation is still required to keep
  // Restaurant.confidenceScore and VerificationRecord.confidenceScore in sync.

  async verifyDish(params: VerifyDishParams): Promise<VerifyDishResult> {
    const { restaurantDishId, adminId, nameAsServed } = params
    const verifiedAt = params.verifiedAt ?? new Date()

    const dish = await db.restaurantDish.findFirst({ where: { id: restaurantDishId } })
    if (!dish) throw new NotFoundError('RestaurantDish')

    const restaurant = await fetchRestaurantForScoring(dish.restaurantId)
    if (!restaurant?.verification) throw new NotFoundError('Restaurant')

    const scoreInput = buildScoreInput(restaurant)
    const { score, breakdown } = calculateScore(scoreInput, 'FIELD_UPDATED')

    await db.$transaction([
      db.restaurantDish.update({
        where: { id: restaurantDishId },
        data:  {
          verifiedAt,
          ...(nameAsServed !== undefined ? { nameAsServed } : {}),
        },
      }),
      db.restaurant.update({
        where: { id: dish.restaurantId },
        data:  { confidenceScore: score },
      }),
      db.verificationRecord.update({
        where: { restaurantId: dish.restaurantId },
        data:  { confidenceScore: score, scoreBreakdown: breakdown as object },
      }),
    ])

    logAudit({ action: 'DISH_VERIFIED', restaurantDishId, restaurantId: dish.restaurantId, adminId })
    logAudit({ action: 'SCORE_RECALCULATED', restaurantId: dish.restaurantId, oldScore: Number(restaurant.confidenceScore), newScore: score, trigger: 'FIELD_UPDATED' })

    return { restaurantDishId, restaurantId: dish.restaurantId, verifiedAt, newScore: score }
  },

  // ── verifyPhoto ──────────────────────────────────────────
  // Updates RestaurantPhoto.isVerified and optionally isPrimary.
  // Score recalculation is triggered ONLY when isVerified changes (§9.4).
  // S2 signal (verifiedPhotoCount ≥ 1) depends on isVerified — the score input
  // is projected to reflect the incoming change before the transaction opens.

  async verifyPhoto(params: VerifyPhotoParams): Promise<VerifyPhotoResult> {
    const { photoId, adminId, isVerified } = params

    const photo = await db.restaurantPhoto.findFirst({ where: { id: photoId } })
    if (!photo) throw new NotFoundError('RestaurantPhoto')

    const restaurant = await fetchRestaurantForScoring(photo.restaurantId)
    if (!restaurant?.verification) throw new NotFoundError('Restaurant')

    const isVerifiedChanging = photo.isVerified !== isVerified

    if (isVerifiedChanging) {
      // Project the verifiedPhotoCount to reflect the incoming change.
      const currentCount = restaurant.photos.length
      const projectedCount = isVerified
        ? currentCount + 1
        : Math.max(0, currentCount - 1)

      const scoreInput = buildScoreInput(restaurant, { verifiedPhotoCount: projectedCount })
      const { score, breakdown } = calculateScore(scoreInput, 'PHOTO_VERIFIED')

      await db.$transaction([
        db.restaurantPhoto.update({
          where: { id: photoId },
          data:  {
            isVerified,
            ...(params.isPrimary !== undefined ? { isPrimary: params.isPrimary } : {}),
          },
        }),
        db.restaurant.update({
          where: { id: photo.restaurantId },
          data:  { confidenceScore: score },
        }),
        db.verificationRecord.update({
          where: { restaurantId: photo.restaurantId },
          data:  { confidenceScore: score, scoreBreakdown: breakdown as object },
        }),
      ])

      logAudit({ action: 'PHOTO_VERIFIED', photoId, restaurantId: photo.restaurantId, adminId })
      logAudit({ action: 'SCORE_RECALCULATED', restaurantId: photo.restaurantId, oldScore: Number(restaurant.confidenceScore), newScore: score, trigger: 'PHOTO_VERIFIED' })

      return {
        photoId,
        restaurantId: photo.restaurantId,
        isVerified,
        isPrimary: params.isPrimary ?? photo.isPrimary,
        newScore: score,
      }
    }

    // isVerified unchanged — update photo fields without score recalculation.
    await db.restaurantPhoto.update({
      where: { id: photoId },
      data:  {
        isVerified,
        ...(params.isPrimary !== undefined ? { isPrimary: params.isPrimary } : {}),
      },
    })

    logAudit({ action: 'PHOTO_VERIFIED', photoId, restaurantId: photo.restaurantId, adminId })

    return {
      photoId,
      restaurantId: photo.restaurantId,
      isVerified,
      isPrimary: params.isPrimary ?? photo.isPrimary,
      newScore: Number(restaurant.confidenceScore),
    }
  },

  // ── updateAvailability ───────────────────────────────────
  // Updates RestaurantDish.availabilityStatus.
  // No score recalculation — availability is not a confidence signal.

  async updateAvailability(params: UpdateAvailabilityParams): Promise<void> {
    const { restaurantDishId, availabilityStatus } = params

    const dish = await db.restaurantDish.findFirst({ where: { id: restaurantDishId } })
    if (!dish) throw new NotFoundError('RestaurantDish')

    await db.restaurantDish.update({
      where: { id: restaurantDishId },
      data:  { availabilityStatus },
    })
  },

  // ── updatePricing ────────────────────────────────────────
  // Updates RestaurantDish.price.
  // No score recalculation — price is not a confidence signal.

  async updatePricing(params: UpdatePricingParams): Promise<void> {
    const { restaurantDishId, price } = params

    const dish = await db.restaurantDish.findFirst({ where: { id: restaurantDishId } })
    if (!dish) throw new NotFoundError('RestaurantDish')

    await db.restaurantDish.update({
      where: { id: restaurantDishId },
      data:  { price },
    })
  },

  // ── recalculateRestaurantIntelligence ────────────────────
  // Updates allowed Restaurant fields and recalculates confidence score.
  // Allowed: description, phone, email, website, priceRange, area.
  // Forbidden fields (name, slug, city, state, verificationStatus) are excluded
  // by the UpdateIntelligenceFields type — TypeScript enforces this boundary.
  //
  // Score input is projected using the NEW field values so the recalculation
  // reflects what the score will be after the update (§6.4).

  async recalculateRestaurantIntelligence(params: UpdateIntelligenceParams): Promise<UpdateIntelligenceResult> {
    const { restaurantId, adminId, fields } = params

    const restaurant = await fetchRestaurantForScoring(restaurantId)
    if (!restaurant) throw new NotFoundError('Restaurant')
    if (!restaurant.verification) throw new NotFoundError('VerificationRecord')

    // Project score input using incoming values where provided, current values otherwise.
    const scoreInput: RestaurantScoreInput = {
      phone:              fields.phone       !== undefined ? (fields.phone       ?? restaurant.phone)       : restaurant.phone,
      description:        fields.description !== undefined ? fields.description                             : restaurant.description,
      email:              fields.email       !== undefined ? fields.email                                   : restaurant.email,
      website:            fields.website     !== undefined ? fields.website                                 : restaurant.website,
      address:            restaurant.address,
      verificationStatus: restaurant.verificationStatus,
      verifiedPhotoCount: restaurant.photos.length,
      activeDishCount:    restaurant.dishes.length,
    }

    const { score, breakdown } = calculateScore(scoreInput, 'FIELD_UPDATED')

    await db.$transaction([
      db.restaurant.update({
        where: { id: restaurantId },
        data:  { ...fields, confidenceScore: score },
      }),
      db.verificationRecord.update({
        where: { restaurantId },
        data:  { confidenceScore: score, scoreBreakdown: breakdown as object },
      }),
    ])

    logAudit({ action: 'SCORE_RECALCULATED', restaurantId, adminId, oldScore: Number(restaurant.confidenceScore), newScore: score, trigger: 'FIELD_UPDATED' })

    return { restaurantId, newScore: score }
  },

  // ── overrideScore ────────────────────────────────────────
  // SUPER-only manual confidence score override (track-02 §9.4).
  // Writes an OverrideBreakdown to VerificationRecord.scoreBreakdown that
  // preserves the last computed breakdown for audit purposes.
  // Validation delegated to validateOverrideRequest in confidence-score.service.

  async overrideScore(params: OverrideScoreParams): Promise<void> {
    const { restaurantId, actorId, actorRole, score, reason } = params

    const restaurant = await db.restaurant.findFirst({
      where:   { id: restaurantId },
      include: { verification: true },
    })
    if (!restaurant) throw new NotFoundError('Restaurant')
    if (!restaurant.verification) throw new NotFoundError('VerificationRecord')

    const validation = validateOverrideRequest(score, reason, actorRole, restaurant.verificationStatus)
    if (!validation.valid) throw new ValidationError(validation.reason)

    const lastComputedBreakdown = restaurant.verification.scoreBreakdown as unknown as SignalBreakdown
    const overrideBreakdown = buildOverrideBreakdown({
      overriddenBy:          actorId,
      overrideScore:         score,
      overrideReason:        reason,
      lastComputedBreakdown,
    })

    await db.$transaction([
      db.restaurant.update({
        where: { id: restaurantId },
        data:  { confidenceScore: score },
      }),
      db.verificationRecord.update({
        where: { restaurantId },
        data:  { confidenceScore: score, scoreBreakdown: overrideBreakdown as object },
      }),
    ])

    logAudit({ action: 'SCORE_OVERRIDE', restaurantId, actorId, actorRole, oldScore: Number(restaurant.confidenceScore), newScore: score, reason })
  },

} as const

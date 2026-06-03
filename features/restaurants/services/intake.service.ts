// Intake Service
//
// Orchestrates the end-to-end restaurant submission pipeline:
//   validate → duplicate check → slug → atomic transaction → confirmation email
//
// Status at creation: PENDING_REVIEW (direct transition — no DRAFT visible to submitter).
// Creates: Restaurant, RestaurantDish[], RestaurantPhoto[], VerificationRecord,
//          VerificationEvent (fromStatus: null, toStatus: PENDING_REVIEW).
//
// Uses `db` (not dbForVerification) — the verificationStatus write guard only blocks
// UPDATE operations; CREATE with verificationStatus set is unguarded by design.
//
// Email is best-effort: Resend failures are swallowed after the transaction commits.
// Dish-ID existence is validated before the transaction to fail fast with a clear 422.
//
// Governed by: restaurant-intake-track.md §2, §6, §7, track-02 §12 Step 5
//              backend-standards.md §3, security-standards.md §9

import { db } from '@/lib/db'
import { ConflictError, ValidationError } from '@/lib/errors'
import { buildCloudinaryUrl } from '@/lib/cloudinary'
import { NotificationService } from '../../verification/services/notification.service'
import { generateSlug, ensureUniqueSlug } from './slug.service'
import { checkForDuplicate } from './duplicate-check.service'
import type { IntakeSubmission } from '../schemas/intake.schema'

export type IntakeResult = {
  submissionId: string
}

export const IntakeService = {
  /**
   * Processes a fully-validated intake submission payload.
   * Returns the new restaurant's ID as the submission reference.
   */
  async submit(payload: IntakeSubmission, ipAddress: string): Promise<IntakeResult> {
    // 1. Validate all dish IDs exist in the DishTaxonomy (service-layer gate)
    const dishIds = payload.dishes.map((d) => d.dishId)
    const foundDishes = await db.dishTaxonomy.findMany({
      where: { id: { in: dishIds }, isActive: true },
      select: { id: true },
    })
    if (foundDishes.length !== dishIds.length) {
      const foundSet = new Set(foundDishes.map((d) => d.id))
      const invalid = dishIds.filter((id) => !foundSet.has(id))
      throw new ValidationError(`One or more dish IDs are not recognised: ${invalid.join(', ')}`)
    }

    // 2. Generate unique URL slug
    const baseSlug = generateSlug(payload.name)
    const slug = await ensureUniqueSlug(baseSlug)

    // 3. Duplicate detection
    const duplicateResult = await checkForDuplicate(payload.name, payload.city)
    if (duplicateResult.status === 'EXACT_DUPLICATE') {
      throw new ConflictError(
        'A restaurant with this name already exists in this city',
        { existingSlug: duplicateResult.existingSlug },
      )
    }

    const internalNotes =
      duplicateResult.status === 'POSSIBLE_DUPLICATE'
        ? buildDuplicateNote(duplicateResult.candidates)
        : null

    // 4. Atomic write: all records created together or none
    const restaurant = await db.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          name: payload.name,
          slug,
          description: payload.description ?? null,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          area: payload.area ?? null,
          phone: payload.phone,
          email: payload.email ?? null,
          website: payload.website ?? null,
          priceRange: payload.priceRange,
          cuisineTypes: payload.cuisineTypes,
          verificationStatus: 'PENDING_REVIEW',
          submittedBy: null,
        },
      })

      await tx.restaurantDish.createMany({
        data: payload.dishes.map((d) => ({
          restaurantId: created.id,
          dishId: d.dishId,
          nameAsServed: d.nameAsServed ?? null,
          description: d.description ?? null,
          price: d.price ?? null,
          availabilityStatus: d.availabilityStatus,
        })),
      })

      if (payload.photos.length > 0) {
        await tx.restaurantPhoto.createMany({
          data: payload.photos.map((p) => ({
            restaurantId: created.id,
            url: buildCloudinaryUrl(p.cloudinaryPublicId),
            isPrimary: p.isPrimary,
          })),
        })
      }

      const verificationRecord = await tx.verificationRecord.create({
        data: {
          restaurantId: created.id,
          currentStatus: 'PENDING_REVIEW',
          confidenceScore: 0,
          scoreBreakdown: {},
          submitterEmail: payload.submitterEmail ?? null,
          internalNotes,
        },
      })

      await tx.verificationEvent.create({
        data: {
          verificationRecordId: verificationRecord.id,
          restaurantId: created.id,
          fromStatus: null,
          toStatus: 'PENDING_REVIEW',
          reason: 'Intake submitted and queued for review',
          actorId: 'SYSTEM',
          actorRole: 'SYSTEM',
          ipAddress,
        },
      })

      return created
    })

    // 5. Confirmation email — best-effort, outside transaction.
    //    NotificationService already catches internally; this try-catch is a
    //    second safety net to guarantee the committed submission is returned.
    try {
      await NotificationService.sendIntakeConfirmation({
        to: payload.submitterEmail ?? null,
        restaurantName: payload.name,
        submissionRef: restaurant.id.slice(0, 8).toUpperCase(),
      })
    } catch {
      // swallow — email failure must never roll back a committed submission
    }

    return { submissionId: restaurant.id }
  },
} as const

function buildDuplicateNote(
  candidates: Array<{ id: string; name: string; similarity: number }>,
): string {
  const list = candidates
    .map((c) => `"${c.name}" (similarity: ${c.similarity.toFixed(2)}, id: ${c.id})`)
    .join('; ')
  return `Possible duplicate detected at intake. Candidates: ${list}`
}

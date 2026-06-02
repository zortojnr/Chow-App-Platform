// Verification Orchestrator Service
//
// Sole authority for changing Restaurant.verificationStatus and
// VerificationRecord.currentStatus. No other module may write these fields.
//
// Governed by: track-02-verification-intelligence.md §4, §5, §8, §9.2, §11
//              verification-system-track.md §1, §5, §7, §8
//              backend-standards.md §2, §3.3
//              security-standards.md §9.1
//
// DB client: dbForVerification only — the `db` export has a write-guard that
// blocks any external update to verificationStatus.

import { VerificationStatus, UserRole } from '@prisma/client'
import { dbForVerification } from '@/lib/db'
import { NotFoundError, ValidationError, GoneError } from '@/lib/errors'
import { validateTransition } from './state-machine'
import {
  calculateScore,
  evaluateApprovalThreshold,
  REJECTED_SCORE,
  type RestaurantScoreInput,
} from './confidence-score.service'
import {
  generateResponseToken,
  validateResponseToken,
  isTokenUsed,
  hashToken,
} from './response-token.service'
import { NotificationService } from './notification.service'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type ApproveParams = {
  restaurantId: string
  actorId:      string
  actorRole:    UserRole.ADMIN | UserRole.SUPER
  ipAddress:    string
  notes?:       string
}

export type ApproveResult = {
  restaurantId:       string
  verificationStatus: VerificationStatus
  confidenceScore:    number
}

export type RejectParams = {
  restaurantId: string
  actorId:      string
  actorRole:    UserRole.ADMIN | UserRole.SUPER
  ipAddress:    string
  reason:       string
}

export type RequestInfoParams = {
  restaurantId:        string
  actorId:             string
  actorRole:           UserRole.ADMIN | UserRole.SUPER
  ipAddress:           string
  feedbackToSubmitter: string
}

export type ProcessSubmitterResponseParams = {
  token:               string
  responseText:        string
  additionalPhotoIds?: string[]
  ipAddress:           string
}

export type AssignAdminParams = {
  restaurantId: string
  adminId:      string
}

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Pre-flight fetch — loads restaurant with all relations needed for score calculation.
 * Uses soft-delete filtering from the dbForVerification extension.
 * track-02 §11.2 — single query, no N+1.
 */
async function fetchForTransition(restaurantId: string) {
  return dbForVerification.restaurant.findFirst({
    where: { id: restaurantId },
    include: {
      verification: true,
      dishes:  { where: { deletedAt: null } },
      photos:  { where: { isVerified: true } },
    },
  })
}

/**
 * Builds the RestaurantScoreInput with the TARGET status substituted.
 * This is what captures S4 at approval time — the calculator sees APPROVED
 * before the DB write, not the current status.
 * track-02 §4.3, §6.4
 */
function buildScoreInput(
  restaurant: Awaited<ReturnType<typeof fetchForTransition>> & object,
  targetStatus: VerificationStatus,
): RestaurantScoreInput {
  return {
    phone:               restaurant.phone,
    description:         restaurant.description,
    address:             restaurant.address,
    website:             restaurant.website,
    email:               restaurant.email,
    verificationStatus:  targetStatus,
    verifiedPhotoCount:  restaurant.photos.length,
    activeDishCount:     restaurant.dishes.length,
  }
}

/**
 * Constructs a Cloudinary CDN URL from a public ID.
 * Used when creating RestaurantPhoto records for additionalPhotoIds.
 */
function buildCloudinaryUrl(publicId: string): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME is not configured')
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export const VerificationService = {

  // ── approve ──────────────────────────────────────────────
  // track-02 §5.3; verification-system-track §5.2

  async approve(params: ApproveParams): Promise<ApproveResult> {
    const { restaurantId, actorId, actorRole, ipAddress, notes } = params

    const restaurant = await fetchForTransition(restaurantId)
    if (!restaurant?.verification) throw new NotFoundError('Restaurant')

    const transition = validateTransition(
      restaurant.verificationStatus,
      VerificationStatus.APPROVED,
      actorRole,
    )
    if (!transition.allowed) throw new ValidationError(transition.reason)

    const scoreInput = buildScoreInput(restaurant, VerificationStatus.APPROVED)
    const threshold  = evaluateApprovalThreshold(scoreInput)
    if (!threshold.passes) {
      throw new ValidationError(
        `Confidence score ${threshold.simulatedScore} is below the required threshold of 0.40`,
      )
    }

    const { score, breakdown } = calculateScore(scoreInput, 'STATUS_TRANSITION')

    const [updated] = await dbForVerification.$transaction([
      dbForVerification.restaurant.update({
        where: { id: restaurantId },
        data:  { verificationStatus: VerificationStatus.APPROVED, confidenceScore: score },
      }),
      dbForVerification.verificationRecord.update({
        where: { restaurantId },
        data:  {
          currentStatus:   VerificationStatus.APPROVED,
          confidenceScore: score,
          scoreBreakdown:  breakdown as object,
          assignedTo:      null,
          ...(notes ? { internalNotes: notes } : {}),
        },
      }),
      dbForVerification.verificationEvent.create({
        data: {
          verificationRecordId: restaurant.verification.id,
          restaurantId,
          fromStatus: restaurant.verificationStatus,
          toStatus:   VerificationStatus.APPROVED,
          actorId,
          actorRole,
          ipAddress,
        },
      }),
    ])

    await NotificationService.sendApproval({
      to:             restaurant.verification.submitterEmail,
      restaurantName: restaurant.name,
    })

    return {
      restaurantId,
      verificationStatus: updated.verificationStatus,
      confidenceScore:    Number(updated.confidenceScore),
    }
  },

  // ── reject ───────────────────────────────────────────────
  // track-02 §5.5; verification-system-track §5.4
  // Score is hard-zeroed per confidence-score.service.ts §1.3.

  async reject(params: RejectParams): Promise<void> {
    const { restaurantId, actorId, actorRole, ipAddress, reason } = params

    const restaurant = await fetchForTransition(restaurantId)
    if (!restaurant?.verification) throw new NotFoundError('Restaurant')

    const transition = validateTransition(
      restaurant.verificationStatus,
      VerificationStatus.REJECTED,
      actorRole,
    )
    if (!transition.allowed) throw new ValidationError(transition.reason)

    const scoreInput = buildScoreInput(restaurant, VerificationStatus.REJECTED)
    const { breakdown } = calculateScore(scoreInput, 'STATUS_TRANSITION')

    await dbForVerification.$transaction([
      dbForVerification.restaurant.update({
        where: { id: restaurantId },
        data:  { verificationStatus: VerificationStatus.REJECTED, confidenceScore: REJECTED_SCORE },
      }),
      dbForVerification.verificationRecord.update({
        where: { restaurantId },
        data:  {
          currentStatus:   VerificationStatus.REJECTED,
          confidenceScore: REJECTED_SCORE,
          scoreBreakdown:  breakdown as object,
          assignedTo:      null,
          internalNotes:   reason,
        },
      }),
      dbForVerification.verificationEvent.create({
        data: {
          verificationRecordId: restaurant.verification.id,
          restaurantId,
          fromStatus: restaurant.verificationStatus,
          toStatus:   VerificationStatus.REJECTED,
          reason,
          actorId,
          actorRole,
          ipAddress,
        },
      }),
    ])

    await NotificationService.sendRejection({
      to:                  restaurant.verification.submitterEmail,
      restaurantName:      restaurant.name,
      feedbackToSubmitter: reason,
    })
  },

  // ── requestInfo ──────────────────────────────────────────
  // track-02 §4.4, §5.4; verification-system-track §5.3

  async requestInfo(params: RequestInfoParams): Promise<void> {
    const { restaurantId, actorId, actorRole, ipAddress, feedbackToSubmitter } = params

    const restaurant = await fetchForTransition(restaurantId)
    if (!restaurant?.verification) throw new NotFoundError('Restaurant')

    const transition = validateTransition(
      restaurant.verificationStatus,
      VerificationStatus.NEEDS_INFO,
      actorRole,
    )
    if (!transition.allowed) throw new ValidationError(transition.reason)

    const scoreInput = buildScoreInput(restaurant, VerificationStatus.NEEDS_INFO)
    const { score, breakdown } = calculateScore(scoreInput, 'STATUS_TRANSITION')

    await dbForVerification.$transaction([
      dbForVerification.restaurant.update({
        where: { id: restaurantId },
        data:  { verificationStatus: VerificationStatus.NEEDS_INFO, confidenceScore: score },
      }),
      dbForVerification.verificationRecord.update({
        where: { restaurantId },
        data:  {
          currentStatus:       VerificationStatus.NEEDS_INFO,
          confidenceScore:     score,
          scoreBreakdown:      breakdown as object,
          assignedTo:          null,
          feedbackToSubmitter,
        },
      }),
      dbForVerification.verificationEvent.create({
        data: {
          verificationRecordId: restaurant.verification.id,
          restaurantId,
          fromStatus: restaurant.verificationStatus,
          toStatus:   VerificationStatus.NEEDS_INFO,
          actorId,
          actorRole,
          ipAddress,
        },
      }),
    ])

    const token = await generateResponseToken(restaurantId, restaurant.verification.id)

    await NotificationService.sendNeedsInfo({
      to:                  restaurant.verification.submitterEmail,
      restaurantName:      restaurant.name,
      feedbackToSubmitter,
      responseToken:       token,
    })
  },

  // ── processSubmitterResponse ─────────────────────────────
  // track-02 §4.4, §9.2; architecture decision: photo records created here.
  // Token consumption is inside the transaction — if transition fails, token is not consumed.

  async processSubmitterResponse(params: ProcessSubmitterResponseParams): Promise<void> {
    const { token, responseText, additionalPhotoIds = [], ipAddress } = params

    // Phase 1: token validation (before any DB write)
    const validation = await validateResponseToken(token)
    if (!validation.valid) {
      throw new ValidationError(`Response token is ${validation.reason.toLowerCase()}`)
    }

    const { restaurantId, verificationRecordId } = validation.payload

    if (await isTokenUsed(token)) {
      throw new GoneError('This response link has already been used')
    }

    const restaurant = await fetchForTransition(restaurantId)
    if (!restaurant?.verification) throw new NotFoundError('Restaurant')

    const transition = validateTransition(
      restaurant.verificationStatus,
      VerificationStatus.PENDING_REVIEW,
      UserRole.SYSTEM,
    )
    if (!transition.allowed) throw new ValidationError(transition.reason)

    const scoreInput = buildScoreInput(restaurant, VerificationStatus.PENDING_REVIEW)
    const { score, breakdown } = calculateScore(scoreInput, 'STATUS_TRANSITION')

    // Phase 2: atomic transaction (status + event + token consumption + photos)
    const photoCreateOps = additionalPhotoIds.map((publicId) =>
      dbForVerification.restaurantPhoto.create({
        data: {
          restaurantId,
          url:        buildCloudinaryUrl(publicId),
          isVerified: false,
          isPrimary:  false,
        },
      }),
    )

    await dbForVerification.$transaction([
      dbForVerification.restaurant.update({
        where: { id: restaurantId },
        data:  { verificationStatus: VerificationStatus.PENDING_REVIEW, confidenceScore: score },
      }),
      dbForVerification.verificationRecord.update({
        where: { restaurantId },
        data:  {
          currentStatus:   VerificationStatus.PENDING_REVIEW,
          confidenceScore: score,
          scoreBreakdown:  breakdown as object,
          assignedTo:      null,
          internalNotes:   responseText,
        },
      }),
      dbForVerification.verificationEvent.create({
        data: {
          verificationRecordId,
          restaurantId,
          fromStatus: restaurant.verificationStatus,
          toStatus:   VerificationStatus.PENDING_REVIEW,
          actorId:    'SYSTEM',
          actorRole:  UserRole.SYSTEM,
          ipAddress,
        },
      }),
      dbForVerification.usedVerificationToken.create({
        data: { tokenHash: hashToken(token) },
      }),
      ...photoCreateOps,
    ])
  },

  // ── assignAdmin ──────────────────────────────────────────
  // Advisory soft-assignment — non-transactional. track-02 §5.1.

  async assignAdmin(params: AssignAdminParams): Promise<void> {
    const { restaurantId, adminId } = params
    try {
      await dbForVerification.verificationRecord.update({
        where: { restaurantId },
        data:  { assignedTo: adminId },
      })
    } catch {
      // Non-critical — failure to soft-assign does not affect verification integrity.
    }
  },

} as const

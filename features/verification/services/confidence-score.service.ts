// Confidence Scoring Service — pure business logic, no I/O.
//
// Governed by: docs/architecture/confidence-scoring-spec.md (authoritative)
// Deliverable:  track-02-verification-intelligence.md §12 Step 2
//
// All constants are immutable source-code values (§3.3).
// Caller is responsible for fetching fresh data (§2.3) and passing it as
// RestaurantScoreInput. DB access lives in verification.service.ts.

import { VerificationStatus, UserRole } from '@prisma/client'

// ─────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────

/**
 * Pre-fetched restaurant data required for score calculation.
 * Caller fetches fresh from DB so every calculation reflects current state (§2.3).
 * verifiedPhotoCount  = COUNT(RestaurantPhoto WHERE isVerified = true)
 * activeDishCount     = COUNT(RestaurantDish    WHERE deletedAt IS NULL)
 */
export type RestaurantScoreInput = {
  phone: string | null
  description: string | null
  address: string
  website: string | null
  email: string | null
  verificationStatus: VerificationStatus
  verifiedPhotoCount: number
  activeDishCount: number
}

// ─────────────────────────────────────────────────────────────
// OUTPUT TYPES
// ─────────────────────────────────────────────────────────────

/** Per-signal contributions — keys match Appendix A keys in the spec */
export type SignalBreakdown = {
  S1_phoneValid: number
  S2_verifiedPhoto: number
  S3_threeDishes: number
  S4_adminApproved: number
  S5_description: number
  S6_detailedAddress: number
  S7_contactChannel: number
  total: number
}

/** Written to VerificationRecord.scoreBreakdown on every standard recalculation (§7.1) */
export type StandardBreakdown = SignalBreakdown & {
  calculatedAt: string          // ISO-8601
  trigger: RecalculationTrigger
}

/** Replaces scoreBreakdown when SUPER manually overrides a score (§6.4) */
export type OverrideBreakdown = {
  overridden: true
  overriddenAt: string          // ISO-8601
  overriddenBy: string          // SUPER user ID
  overrideScore: number
  overrideReason: string
  lastComputedBreakdown: SignalBreakdown
}

export type ScoreResult = {
  score: number
  breakdown: StandardBreakdown
}

export type ThresholdResult =
  | { passes: true; simulatedScore: number }
  | { passes: false; simulatedScore: number; code: 'SCORE_BELOW_THRESHOLD' }

export type OverrideErrorCode =
  | 'UNAUTHORIZED_ACTOR'
  | 'OVERRIDE_NOT_ALLOWED_IN_DRAFT'
  | 'REASON_TOO_SHORT'
  | 'SCORE_OUT_OF_RANGE'

export type OverrideValidationResult =
  | { valid: true }
  | { valid: false; code: OverrideErrorCode; reason: string }

/** Events that may trigger a score recalculation — §5.2 */
export type RecalculationTrigger =
  | 'STATUS_TRANSITION'
  | 'PHOTO_VERIFIED'
  | 'DISH_ADDED'
  | 'DISH_REMOVED'
  | 'FIELD_UPDATED'

// ─────────────────────────────────────────────────────────────
// CONSTANTS  §1.1, §2.1, §3.1, §4.1
// ─────────────────────────────────────────────────────────────

export const SCORE_MIN = 0 as const
export const SCORE_MAX = 1 as const

/**
 * Hard score for REJECTED restaurants (§1.3).
 * Enforced by the transition handler in verification.service.ts — not by the calculator.
 * Exported here so verification.service.ts can reference the canonical value.
 */
export const REJECTED_SCORE = 0 as const

/** §2.1 S1 — Nigerian phone number pattern */
export const NIGERIAN_PHONE_REGEX = /^(\+?234|0)[789][01]\d{8}$/

/**
 * Signal weights — §3.1.
 * Must not be derived from config, env variables, or database records (§3.3).
 * Changing any weight requires a code change and a corresponding update to
 * confidence-scoring-spec.md §3.1.
 */
export const SIGNAL_WEIGHTS = {
  S1_phoneValid:      0.20,
  S2_verifiedPhoto:   0.15,
  S3_threeDishes:     0.15,
  S4_adminApproved:   0.25,
  S5_description:     0.10,
  S6_detailedAddress: 0.10,
  S7_contactChannel:  0.05,
} as const

/** §4.1 — minimum post-approval confidence score */
export const APPROVAL_THRESHOLD = 0.400

const OVERRIDE_REASON_MIN_LENGTH = 10  // §6.2

// ─────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────

function clampScore(n: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, n))
}

/**
 * Evaluates all seven signals and returns a breakdown with total (§2.1, §3.1).
 * Every signal is binary — full weight or zero, no partial credit (§2).
 * Total is rounded to 3 decimal places per §1.1.
 */
function evaluateSignals(input: RestaurantScoreInput): SignalBreakdown {
  // S1: non-null phone that passes the Nigerian format regex
  const S1 = input.phone !== null && NIGERIAN_PHONE_REGEX.test(input.phone)
    ? SIGNAL_WEIGHTS.S1_phoneValid : 0

  // S2: at least one admin-verified photo
  const S2 = input.verifiedPhotoCount >= 1
    ? SIGNAL_WEIGHTS.S2_verifiedPhoto : 0

  // S3: three or more active (non-deleted) dishes
  const S3 = input.activeDishCount >= 3
    ? SIGNAL_WEIGHTS.S3_threeDishes : 0

  // S4: earned only when status is APPROVED — automatically lost on any other status
  const S4 = input.verificationStatus === VerificationStatus.APPROVED
    ? SIGNAL_WEIGHTS.S4_adminApproved : 0

  // S5: description present and at least 50 characters
  const S5 = input.description !== null && input.description.length >= 50
    ? SIGNAL_WEIGHTS.S5_description : 0

  // S6: address at least 20 characters (proxy for street-level address)
  const S6 = input.address.length >= 20
    ? SIGNAL_WEIGHTS.S6_detailedAddress : 0

  // S7: at least one non-empty contact channel beyond the phone number
  const S7 =
    (input.website !== null && input.website !== '') ||
    (input.email !== null && input.email !== '')
      ? SIGNAL_WEIGHTS.S7_contactChannel : 0

  const total = parseFloat(
    clampScore(S1 + S2 + S3 + S4 + S5 + S6 + S7).toFixed(3),
  )

  return {
    S1_phoneValid:      S1,
    S2_verifiedPhoto:   S2,
    S3_threeDishes:     S3,
    S4_adminApproved:   S4,
    S5_description:     S5,
    S6_detailedAddress: S6,
    S7_contactChannel:  S7,
    total,
  }
}

// ─────────────────────────────────────────────────────────────
// SCORE CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────

/**
 * Primary entry point. Returns score and full breakdown in one pass.
 *
 * Caller must provide current data freshly fetched from DB (§2.3).
 * For REJECTED restaurants the score here reflects the natural signal evaluation;
 * verification.service.ts is responsible for hard-zeroing the persisted score (§1.3).
 */
export function calculateScore(
  input: RestaurantScoreInput,
  trigger: RecalculationTrigger,
): ScoreResult {
  const signals = evaluateSignals(input)
  const breakdown: StandardBreakdown = {
    ...signals,
    calculatedAt: new Date().toISOString(),
    trigger,
  }
  return { score: signals.total, breakdown }
}

/** Returns the score only — track-02 Step 2 API surface */
export function calculateConfidenceScore(input: RestaurantScoreInput): number {
  return evaluateSignals(input).total
}

/** Returns the breakdown only — track-02 Step 2 API surface */
export function getScoreBreakdown(
  input: RestaurantScoreInput,
  trigger: RecalculationTrigger,
): StandardBreakdown {
  return calculateScore(input, trigger).breakdown
}

// ─────────────────────────────────────────────────────────────
// THRESHOLD EVALUATION  §4
// ─────────────────────────────────────────────────────────────

/**
 * Simulates the post-approval score by treating verificationStatus as APPROVED,
 * regardless of the restaurant's current status (§4.2 step 3).
 * Used exclusively for the pre-commit threshold gate — no DB writes.
 */
export function simulateApprovalScore(input: RestaurantScoreInput): number {
  return evaluateSignals({
    ...input,
    verificationStatus: VerificationStatus.APPROVED,
  }).total
}

/**
 * Evaluates the approval threshold gate (§4.1, §4.2).
 *
 * Returns whether the approval would pass and the simulated post-approval score.
 * SUPER forceApprove override (§4.4) is handled in the orchestrator layer
 * (verification.service.ts) — this function always reports the threshold truth.
 */
export function evaluateApprovalThreshold(input: RestaurantScoreInput): ThresholdResult {
  const simulatedScore = simulateApprovalScore(input)

  if (simulatedScore >= APPROVAL_THRESHOLD) {
    return { passes: true, simulatedScore }
  }

  return { passes: false, simulatedScore, code: 'SCORE_BELOW_THRESHOLD' }
}

// ─────────────────────────────────────────────────────────────
// OVERRIDE HANDLING  §6
// ─────────────────────────────────────────────────────────────

/**
 * Validates a manual score override request before any DB write (§6.1, §6.2).
 * Does not apply the override; only determines whether it is permitted.
 */
export function validateOverrideRequest(
  score: number,
  reason: string,
  actorRole: UserRole,
  currentStatus: VerificationStatus,
): OverrideValidationResult {
  if (actorRole !== UserRole.SUPER) {
    return {
      valid: false,
      code: 'UNAUTHORIZED_ACTOR',
      reason: 'Only SUPER role can manually override confidence scores',
    }
  }

  if (currentStatus === VerificationStatus.DRAFT) {
    return {
      valid: false,
      code: 'OVERRIDE_NOT_ALLOWED_IN_DRAFT',
      reason: 'Score override is not permitted while the restaurant is in DRAFT status',
    }
  }

  if (!reason || reason.length < OVERRIDE_REASON_MIN_LENGTH) {
    return {
      valid: false,
      code: 'REASON_TOO_SHORT',
      reason: `Override reason must be at least ${OVERRIDE_REASON_MIN_LENGTH} characters`,
    }
  }

  if (score < SCORE_MIN || score > SCORE_MAX) {
    return {
      valid: false,
      code: 'SCORE_OUT_OF_RANGE',
      reason: `Override score must be between ${SCORE_MIN} and ${SCORE_MAX}, received ${score}`,
    }
  }

  return { valid: true }
}

/**
 * Constructs the override marker structure written to
 * VerificationRecord.scoreBreakdown when a score is overridden (§6.4).
 *
 * Caller should compute the current breakdown via calculateScore() first,
 * then pass it as lastComputedBreakdown to preserve the pre-override reference.
 */
export function buildOverrideBreakdown(params: {
  overriddenBy: string
  overrideScore: number
  overrideReason: string
  lastComputedBreakdown: SignalBreakdown
}): OverrideBreakdown {
  return {
    overridden: true,
    overriddenAt: new Date().toISOString(),
    overriddenBy: params.overriddenBy,
    overrideScore: params.overrideScore,
    overrideReason: params.overrideReason,
    lastComputedBreakdown: params.lastComputedBreakdown,
  }
}

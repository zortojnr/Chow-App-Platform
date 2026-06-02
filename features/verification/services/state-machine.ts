// Verification state machine — pure transition validator.
// No I/O. No side effects. Called by verification.service.ts before every DB write.
//
// Governed by: track-02-verification-intelligence.md §4.1, §4.2
// Deliverable: track-02 §12 Step 1

import { VerificationStatus, UserRole } from '@prisma/client'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type TransitionErrorCode = 'INVALID_TRANSITION' | 'UNAUTHORIZED_ACTOR'

export type TransitionResult =
  | { allowed: true }
  | { allowed: false; code: TransitionErrorCode; reason: string }

// ─────────────────────────────────────────────────────────────
// ALLOWED TRANSITIONS
//
// Source of truth: track-02-verification-intelligence.md §4.1
//
// Key format: `${fromStatus}:${toStatus}`
// Value: roles authorized to execute the transition
//
// Every (from, to) pair NOT in this map is forbidden.
// ─────────────────────────────────────────────────────────────

export const ALLOWED_TRANSITIONS: ReadonlyMap<string, ReadonlyArray<UserRole>> = new Map([
  // Automatic on submission — SYSTEM only
  [`${VerificationStatus.DRAFT}:${VerificationStatus.PENDING_REVIEW}`, [UserRole.SYSTEM]],

  // Admin review decisions
  [`${VerificationStatus.PENDING_REVIEW}:${VerificationStatus.APPROVED}`,   [UserRole.ADMIN, UserRole.SUPER]],
  [`${VerificationStatus.PENDING_REVIEW}:${VerificationStatus.NEEDS_INFO}`, [UserRole.ADMIN, UserRole.SUPER]],
  [`${VerificationStatus.PENDING_REVIEW}:${VerificationStatus.REJECTED}`,   [UserRole.ADMIN, UserRole.SUPER]],

  // Submitter responds — SYSTEM advances back to review queue
  [`${VerificationStatus.NEEDS_INFO}:${VerificationStatus.PENDING_REVIEW}`, [UserRole.SYSTEM]],

  // Stale or irrecoverable NEEDS_INFO — admin rejects
  [`${VerificationStatus.NEEDS_INFO}:${VerificationStatus.REJECTED}`,       [UserRole.ADMIN, UserRole.SUPER]],

  // Post-approval corrections
  [`${VerificationStatus.APPROVED}:${VerificationStatus.NEEDS_INFO}`,       [UserRole.ADMIN, UserRole.SUPER]],
  [`${VerificationStatus.APPROVED}:${VerificationStatus.REJECTED}`,         [UserRole.ADMIN, UserRole.SUPER]],

  // Appeal / resubmission
  [`${VerificationStatus.REJECTED}:${VerificationStatus.PENDING_REVIEW}`,   [UserRole.ADMIN, UserRole.SUPER]],
])

// ─────────────────────────────────────────────────────────────
// TRANSITION VALIDATOR
//
// Returns { allowed: true } or a typed error — never throws.
// Call this before every state change; if not allowed, abort.
// ─────────────────────────────────────────────────────────────

export function validateTransition(
  from: VerificationStatus,
  to: VerificationStatus,
  actorRole: UserRole,
): TransitionResult {
  const key = `${from}:${to}`
  const allowedActors = ALLOWED_TRANSITIONS.get(key)

  if (allowedActors === undefined) {
    return {
      allowed: false,
      code: 'INVALID_TRANSITION',
      reason: `No transition path exists from ${from} to ${to}`,
    }
  }

  if (!(allowedActors as ReadonlyArray<string>).includes(actorRole)) {
    return {
      allowed: false,
      code: 'UNAUTHORIZED_ACTOR',
      reason: `Role ${actorRole} is not authorized to transition ${from} → ${to}`,
    }
  }

  return { allowed: true }
}

// Verification state machine — unit tests
//
// Exit criteria (track-02 §12 Step 1):
//   ✓ Every valid transition with each authorized actor → allowed: true
//   ✓ Every valid transition with each unauthorized actor → UNAUTHORIZED_ACTOR
//   ✓ Every forbidden (from, to) pair → INVALID_TRANSITION
//   ✓ All 5 × 5 = 25 possible pairs accounted for (9 valid + 16 forbidden)

import { describe, it, expect } from 'vitest'
import { VerificationStatus, UserRole } from '@prisma/client'
import { validateTransition, ALLOWED_TRANSITIONS } from './state-machine'

const { DRAFT, PENDING_REVIEW, NEEDS_INFO, APPROVED, REJECTED } = VerificationStatus
const { USER, ADMIN, SUPER, SYSTEM } = UserRole

// ─────────────────────────────────────────────────────────────
// CONSTANTS TABLE
// ─────────────────────────────────────────────────────────────

describe('ALLOWED_TRANSITIONS', () => {
  it('defines exactly 9 transitions', () => {
    expect(ALLOWED_TRANSITIONS.size).toBe(9)
  })

  it('does not include any self-transition', () => {
    const statuses = [DRAFT, PENDING_REVIEW, NEEDS_INFO, APPROVED, REJECTED]
    for (const s of statuses) {
      expect(ALLOWED_TRANSITIONS.has(`${s}:${s}`)).toBe(false)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// VALID TRANSITIONS — AUTHORIZED ACTORS
// ─────────────────────────────────────────────────────────────

describe('valid transitions — authorized actors', () => {
  // 1. DRAFT → PENDING_REVIEW (SYSTEM)
  it('DRAFT → PENDING_REVIEW: allows SYSTEM', () => {
    expect(validateTransition(DRAFT, PENDING_REVIEW, SYSTEM)).toEqual({ allowed: true })
  })

  // 2. PENDING_REVIEW → APPROVED (ADMIN, SUPER)
  it('PENDING_REVIEW → APPROVED: allows ADMIN', () => {
    expect(validateTransition(PENDING_REVIEW, APPROVED, ADMIN)).toEqual({ allowed: true })
  })
  it('PENDING_REVIEW → APPROVED: allows SUPER', () => {
    expect(validateTransition(PENDING_REVIEW, APPROVED, SUPER)).toEqual({ allowed: true })
  })

  // 3. PENDING_REVIEW → NEEDS_INFO (ADMIN, SUPER)
  it('PENDING_REVIEW → NEEDS_INFO: allows ADMIN', () => {
    expect(validateTransition(PENDING_REVIEW, NEEDS_INFO, ADMIN)).toEqual({ allowed: true })
  })
  it('PENDING_REVIEW → NEEDS_INFO: allows SUPER', () => {
    expect(validateTransition(PENDING_REVIEW, NEEDS_INFO, SUPER)).toEqual({ allowed: true })
  })

  // 4. PENDING_REVIEW → REJECTED (ADMIN, SUPER)
  it('PENDING_REVIEW → REJECTED: allows ADMIN', () => {
    expect(validateTransition(PENDING_REVIEW, REJECTED, ADMIN)).toEqual({ allowed: true })
  })
  it('PENDING_REVIEW → REJECTED: allows SUPER', () => {
    expect(validateTransition(PENDING_REVIEW, REJECTED, SUPER)).toEqual({ allowed: true })
  })

  // 5. NEEDS_INFO → PENDING_REVIEW (SYSTEM)
  it('NEEDS_INFO → PENDING_REVIEW: allows SYSTEM', () => {
    expect(validateTransition(NEEDS_INFO, PENDING_REVIEW, SYSTEM)).toEqual({ allowed: true })
  })

  // 6. NEEDS_INFO → REJECTED (ADMIN, SUPER)
  it('NEEDS_INFO → REJECTED: allows ADMIN', () => {
    expect(validateTransition(NEEDS_INFO, REJECTED, ADMIN)).toEqual({ allowed: true })
  })
  it('NEEDS_INFO → REJECTED: allows SUPER', () => {
    expect(validateTransition(NEEDS_INFO, REJECTED, SUPER)).toEqual({ allowed: true })
  })

  // 7. APPROVED → NEEDS_INFO (ADMIN, SUPER)
  it('APPROVED → NEEDS_INFO: allows ADMIN', () => {
    expect(validateTransition(APPROVED, NEEDS_INFO, ADMIN)).toEqual({ allowed: true })
  })
  it('APPROVED → NEEDS_INFO: allows SUPER', () => {
    expect(validateTransition(APPROVED, NEEDS_INFO, SUPER)).toEqual({ allowed: true })
  })

  // 8. APPROVED → REJECTED (ADMIN, SUPER)
  it('APPROVED → REJECTED: allows ADMIN', () => {
    expect(validateTransition(APPROVED, REJECTED, ADMIN)).toEqual({ allowed: true })
  })
  it('APPROVED → REJECTED: allows SUPER', () => {
    expect(validateTransition(APPROVED, REJECTED, SUPER)).toEqual({ allowed: true })
  })

  // 9. REJECTED → PENDING_REVIEW (ADMIN, SUPER)
  it('REJECTED → PENDING_REVIEW: allows ADMIN', () => {
    expect(validateTransition(REJECTED, PENDING_REVIEW, ADMIN)).toEqual({ allowed: true })
  })
  it('REJECTED → PENDING_REVIEW: allows SUPER', () => {
    expect(validateTransition(REJECTED, PENDING_REVIEW, SUPER)).toEqual({ allowed: true })
  })
})

// ─────────────────────────────────────────────────────────────
// VALID TRANSITIONS — UNAUTHORIZED ACTORS
// ─────────────────────────────────────────────────────────────

describe('valid transitions — unauthorized actors', () => {
  // DRAFT → PENDING_REVIEW is SYSTEM-only
  it('DRAFT → PENDING_REVIEW: blocks ADMIN', () => {
    const result = validateTransition(DRAFT, PENDING_REVIEW, ADMIN)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('DRAFT → PENDING_REVIEW: blocks SUPER', () => {
    const result = validateTransition(DRAFT, PENDING_REVIEW, SUPER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('DRAFT → PENDING_REVIEW: blocks USER', () => {
    const result = validateTransition(DRAFT, PENDING_REVIEW, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // PENDING_REVIEW → APPROVED: SYSTEM cannot approve
  it('PENDING_REVIEW → APPROVED: blocks SYSTEM', () => {
    const result = validateTransition(PENDING_REVIEW, APPROVED, SYSTEM)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('PENDING_REVIEW → APPROVED: blocks USER', () => {
    const result = validateTransition(PENDING_REVIEW, APPROVED, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // PENDING_REVIEW → NEEDS_INFO: SYSTEM and USER blocked
  it('PENDING_REVIEW → NEEDS_INFO: blocks SYSTEM', () => {
    const result = validateTransition(PENDING_REVIEW, NEEDS_INFO, SYSTEM)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('PENDING_REVIEW → NEEDS_INFO: blocks USER', () => {
    const result = validateTransition(PENDING_REVIEW, NEEDS_INFO, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // PENDING_REVIEW → REJECTED: SYSTEM and USER blocked
  it('PENDING_REVIEW → REJECTED: blocks SYSTEM', () => {
    const result = validateTransition(PENDING_REVIEW, REJECTED, SYSTEM)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('PENDING_REVIEW → REJECTED: blocks USER', () => {
    const result = validateTransition(PENDING_REVIEW, REJECTED, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // NEEDS_INFO → PENDING_REVIEW is SYSTEM-only
  it('NEEDS_INFO → PENDING_REVIEW: blocks ADMIN', () => {
    const result = validateTransition(NEEDS_INFO, PENDING_REVIEW, ADMIN)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('NEEDS_INFO → PENDING_REVIEW: blocks SUPER', () => {
    const result = validateTransition(NEEDS_INFO, PENDING_REVIEW, SUPER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('NEEDS_INFO → PENDING_REVIEW: blocks USER', () => {
    const result = validateTransition(NEEDS_INFO, PENDING_REVIEW, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // NEEDS_INFO → REJECTED: SYSTEM and USER blocked
  it('NEEDS_INFO → REJECTED: blocks SYSTEM', () => {
    const result = validateTransition(NEEDS_INFO, REJECTED, SYSTEM)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('NEEDS_INFO → REJECTED: blocks USER', () => {
    const result = validateTransition(NEEDS_INFO, REJECTED, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // APPROVED → NEEDS_INFO: SYSTEM and USER blocked
  it('APPROVED → NEEDS_INFO: blocks SYSTEM', () => {
    const result = validateTransition(APPROVED, NEEDS_INFO, SYSTEM)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('APPROVED → NEEDS_INFO: blocks USER', () => {
    const result = validateTransition(APPROVED, NEEDS_INFO, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // APPROVED → REJECTED: SYSTEM and USER blocked
  it('APPROVED → REJECTED: blocks SYSTEM', () => {
    const result = validateTransition(APPROVED, REJECTED, SYSTEM)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('APPROVED → REJECTED: blocks USER', () => {
    const result = validateTransition(APPROVED, REJECTED, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // REJECTED → PENDING_REVIEW: SYSTEM and USER blocked
  it('REJECTED → PENDING_REVIEW: blocks SYSTEM', () => {
    const result = validateTransition(REJECTED, PENDING_REVIEW, SYSTEM)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
  it('REJECTED → PENDING_REVIEW: blocks USER', () => {
    const result = validateTransition(REJECTED, PENDING_REVIEW, USER)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })
})

// ─────────────────────────────────────────────────────────────
// FORBIDDEN TRANSITIONS — INVALID_TRANSITION
//
// All 25 (from, to) pairs minus the 9 valid ones = 16 forbidden.
// Self-transitions (5) + illegal path transitions (11) = 16.
// ─────────────────────────────────────────────────────────────

describe('forbidden transitions — INVALID_TRANSITION', () => {
  function assertForbidden(from: VerificationStatus, to: VerificationStatus) {
    for (const role of [ADMIN, SUPER, SYSTEM, USER]) {
      const result = validateTransition(from, to, role)
      expect(
        result.allowed,
        `Expected ${from} → ${to} with ${role} to be forbidden`,
      ).toBe(false)
      if (!result.allowed) {
        expect(result.code).toBe('INVALID_TRANSITION')
      }
    }
  }

  // ── Self-transitions (5) ─────────────────────────────────────
  it('DRAFT → DRAFT is forbidden', () => assertForbidden(DRAFT, DRAFT))
  it('PENDING_REVIEW → PENDING_REVIEW is forbidden', () => assertForbidden(PENDING_REVIEW, PENDING_REVIEW))
  it('NEEDS_INFO → NEEDS_INFO is forbidden', () => assertForbidden(NEEDS_INFO, NEEDS_INFO))
  it('APPROVED → APPROVED is forbidden', () => assertForbidden(APPROVED, APPROVED))
  it('REJECTED → REJECTED is forbidden', () => assertForbidden(REJECTED, REJECTED))

  // ── Illegal forward skips from DRAFT (3) ────────────────────
  it('DRAFT → APPROVED is forbidden (must pass through PENDING_REVIEW)', () => assertForbidden(DRAFT, APPROVED))
  it('DRAFT → NEEDS_INFO is forbidden', () => assertForbidden(DRAFT, NEEDS_INFO))
  it('DRAFT → REJECTED is forbidden', () => assertForbidden(DRAFT, REJECTED))

  // ── Backwards from PENDING_REVIEW (1) ───────────────────────
  it('PENDING_REVIEW → DRAFT is forbidden', () => assertForbidden(PENDING_REVIEW, DRAFT))

  // ── Illegal from NEEDS_INFO (2) ─────────────────────────────
  it('NEEDS_INFO → DRAFT is forbidden', () => assertForbidden(NEEDS_INFO, DRAFT))
  it('NEEDS_INFO → APPROVED is forbidden (must re-enter review first)', () => assertForbidden(NEEDS_INFO, APPROVED))

  // ── Illegal from APPROVED (2) ───────────────────────────────
  it('APPROVED → DRAFT is forbidden', () => assertForbidden(APPROVED, DRAFT))
  it('APPROVED → PENDING_REVIEW is forbidden (must go via NEEDS_INFO or REJECTED)', () => assertForbidden(APPROVED, PENDING_REVIEW))

  // ── Illegal from REJECTED (3) ───────────────────────────────
  it('REJECTED → DRAFT is forbidden', () => assertForbidden(REJECTED, DRAFT))
  it('REJECTED → NEEDS_INFO is forbidden', () => assertForbidden(REJECTED, NEEDS_INFO))
  it('REJECTED → APPROVED is forbidden (must re-enter review first)', () => assertForbidden(REJECTED, APPROVED))
})

// ─────────────────────────────────────────────────────────────
// ERROR SHAPE
// ─────────────────────────────────────────────────────────────

describe('error shape', () => {
  it('INVALID_TRANSITION result includes a non-empty reason string', () => {
    const result = validateTransition(DRAFT, APPROVED, ADMIN)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('UNAUTHORIZED_ACTOR result includes a non-empty reason string', () => {
    const result = validateTransition(DRAFT, PENDING_REVIEW, ADMIN)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('allowed result has no code or reason fields', () => {
    const result = validateTransition(DRAFT, PENDING_REVIEW, SYSTEM)
    expect(result.allowed).toBe(true)
    expect(result).not.toHaveProperty('code')
    expect(result).not.toHaveProperty('reason')
  })
})

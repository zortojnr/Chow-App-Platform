// Confidence Scoring Service — unit tests
//
// Coverage goals:
//   ✓ All spec examples A–F reproduced exactly (confidence-scoring-spec.md §8)
//   ✓ Each of the 7 signals individually: earned vs not earned, boundary conditions
//   ✓ Score precision: 3 decimal places, clamping
//   ✓ simulateApprovalScore: always treats status as APPROVED
//   ✓ evaluateApprovalThreshold: pass/fail, exact boundary (0.400), Appendix C matrix
//   ✓ validateOverrideRequest: every condition from §6.2
//   ✓ buildOverrideBreakdown: structure and fields
//   ✓ SIGNAL_WEIGHTS sum to 1.000

import { describe, it, expect } from 'vitest'
import { VerificationStatus, UserRole } from '@prisma/client'
import {
  SIGNAL_WEIGHTS,
  APPROVAL_THRESHOLD,
  NIGERIAN_PHONE_REGEX,
  REJECTED_SCORE,
  SCORE_MIN,
  SCORE_MAX,
  calculateScore,
  calculateConfidenceScore,
  getScoreBreakdown,
  simulateApprovalScore,
  evaluateApprovalThreshold,
  validateOverrideRequest,
  buildOverrideBreakdown,
  type RestaurantScoreInput,
  type SignalBreakdown,
} from './confidence-score.service'

const { DRAFT, PENDING_REVIEW, NEEDS_INFO, APPROVED, REJECTED } = VerificationStatus
const { USER, ADMIN, SUPER, SYSTEM } = UserRole

// ─────────────────────────────────────────────────────────────
// TEST FIXTURE FACTORY
//
// Baseline: every signal NOT earned (score = 0.000).
// Each test enables exactly the signals it needs.
// ─────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<RestaurantScoreInput> = {}): RestaurantScoreInput {
  return {
    phone: null,
    description: null,
    address: '',
    website: null,
    email: null,
    verificationStatus: PENDING_REVIEW,
    verifiedPhotoCount: 0,
    activeDishCount: 0,
    ...overrides,
  }
}

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

describe('SIGNAL_WEIGHTS', () => {
  it('all seven weights sum to exactly 1.000', () => {
    const sum = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(parseFloat(sum.toFixed(3))).toBe(1)
  })

  it('defines exactly 7 weights', () => {
    expect(Object.keys(SIGNAL_WEIGHTS)).toHaveLength(7)
  })

  it('individual weight values match spec §3.1', () => {
    expect(SIGNAL_WEIGHTS.S1_phoneValid).toBe(0.20)
    expect(SIGNAL_WEIGHTS.S2_verifiedPhoto).toBe(0.15)
    expect(SIGNAL_WEIGHTS.S3_threeDishes).toBe(0.15)
    expect(SIGNAL_WEIGHTS.S4_adminApproved).toBe(0.25)
    expect(SIGNAL_WEIGHTS.S5_description).toBe(0.10)
    expect(SIGNAL_WEIGHTS.S6_detailedAddress).toBe(0.10)
    expect(SIGNAL_WEIGHTS.S7_contactChannel).toBe(0.05)
  })

  it('APPROVAL_THRESHOLD is 0.400', () => {
    expect(APPROVAL_THRESHOLD).toBe(0.400)
  })

  it('REJECTED_SCORE is 0', () => {
    expect(REJECTED_SCORE).toBe(0)
  })

  it('SCORE_MIN is 0 and SCORE_MAX is 1', () => {
    expect(SCORE_MIN).toBe(0)
    expect(SCORE_MAX).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
// NIGERIAN PHONE REGEX  §2.1 S1
// ─────────────────────────────────────────────────────────────

describe('NIGERIAN_PHONE_REGEX', () => {
  const valid = [
    '08012345678',    // 0 prefix, 7-series
    '07012345678',    // 0 prefix, 7-series
    '09012345678',    // 0 prefix, 9-series
    '08112345678',    // 0 prefix, 81-series
    '2348012345678',  // 234 prefix without +
    '+2348012345678', // +234 prefix
    '+2349012345678', // +234, 9-series
  ]

  const invalid = [
    '0612345678901',  // 06 prefix — not [789]
    '0801234567',     // too short (10 digits)
    '080123456789',   // too long (12 digits)
    '+12345678901',   // US number
    '12345678901',    // does not start with 234 or 0[789]
    '',               // empty string
    'notaphone',      // non-numeric
    '00812345678',    // double 0 prefix
  ]

  for (const n of valid) {
    it(`accepts ${n}`, () => {
      expect(NIGERIAN_PHONE_REGEX.test(n)).toBe(true)
    })
  }

  for (const n of invalid) {
    it(`rejects "${n}"`, () => {
      expect(NIGERIAN_PHONE_REGEX.test(n)).toBe(false)
    })
  }
})

// ─────────────────────────────────────────────────────────────
// SIGNAL S1 — Valid Phone  §2.1
// ─────────────────────────────────────────────────────────────

describe('S1 — valid phone', () => {
  it('valid Nigerian phone earns S1 (0.20)', () => {
    const { score } = calculateScore(makeInput({ phone: '08012345678' }), 'FIELD_UPDATED')
    expect(score).toBe(0.2)
  })

  it('null phone does not earn S1', () => {
    const { score } = calculateScore(makeInput({ phone: null }), 'FIELD_UPDATED')
    expect(score).toBe(0)
  })

  it('invalid phone format does not earn S1', () => {
    const { score } = calculateScore(makeInput({ phone: '0601234567' }), 'FIELD_UPDATED')
    expect(score).toBe(0)
  })

  it('re-validates phone at calculation time regardless of intake validation', () => {
    // A phone that passed intake but was later manually edited to an invalid format
    const { breakdown } = calculateScore(makeInput({ phone: 'invalid' }), 'FIELD_UPDATED')
    expect(breakdown.S1_phoneValid).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SIGNAL S2 — Verified Photo  §2.1
// ─────────────────────────────────────────────────────────────

describe('S2 — verified photo', () => {
  it('1 verified photo earns S2 (0.15)', () => {
    const { breakdown } = calculateScore(makeInput({ verifiedPhotoCount: 1 }), 'PHOTO_VERIFIED')
    expect(breakdown.S2_verifiedPhoto).toBe(0.15)
  })

  it('multiple verified photos still earns S2 only once (0.15)', () => {
    const { breakdown } = calculateScore(makeInput({ verifiedPhotoCount: 5 }), 'PHOTO_VERIFIED')
    expect(breakdown.S2_verifiedPhoto).toBe(0.15)
  })

  it('0 verified photos does not earn S2', () => {
    const { breakdown } = calculateScore(makeInput({ verifiedPhotoCount: 0 }), 'PHOTO_VERIFIED')
    expect(breakdown.S2_verifiedPhoto).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SIGNAL S3 — Three or More Active Dishes  §2.1
// ─────────────────────────────────────────────────────────────

describe('S3 — three or more active dishes', () => {
  it('exactly 3 dishes earns S3 (0.15)', () => {
    const { breakdown } = calculateScore(makeInput({ activeDishCount: 3 }), 'DISH_ADDED')
    expect(breakdown.S3_threeDishes).toBe(0.15)
  })

  it('more than 3 dishes earns S3 (0.15)', () => {
    const { breakdown } = calculateScore(makeInput({ activeDishCount: 10 }), 'DISH_ADDED')
    expect(breakdown.S3_threeDishes).toBe(0.15)
  })

  it('2 dishes does not earn S3', () => {
    const { breakdown } = calculateScore(makeInput({ activeDishCount: 2 }), 'DISH_REMOVED')
    expect(breakdown.S3_threeDishes).toBe(0)
  })

  it('0 dishes does not earn S3', () => {
    const { breakdown } = calculateScore(makeInput({ activeDishCount: 0 }), 'DISH_REMOVED')
    expect(breakdown.S3_threeDishes).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SIGNAL S4 — Admin Verification  §2.1
// ─────────────────────────────────────────────────────────────

describe('S4 — admin verification (APPROVED status)', () => {
  it('APPROVED status earns S4 (0.25)', () => {
    const { breakdown } = calculateScore(makeInput({ verificationStatus: APPROVED }), 'STATUS_TRANSITION')
    expect(breakdown.S4_adminApproved).toBe(0.25)
  })

  it('DRAFT status does not earn S4', () => {
    const { breakdown } = calculateScore(makeInput({ verificationStatus: DRAFT }), 'STATUS_TRANSITION')
    expect(breakdown.S4_adminApproved).toBe(0)
  })

  it('PENDING_REVIEW status does not earn S4', () => {
    const { breakdown } = calculateScore(makeInput({ verificationStatus: PENDING_REVIEW }), 'STATUS_TRANSITION')
    expect(breakdown.S4_adminApproved).toBe(0)
  })

  it('NEEDS_INFO status does not earn S4', () => {
    const { breakdown } = calculateScore(makeInput({ verificationStatus: NEEDS_INFO }), 'STATUS_TRANSITION')
    expect(breakdown.S4_adminApproved).toBe(0)
  })

  it('REJECTED status does not earn S4 — score reflects natural signals only', () => {
    // The hard-zero enforcement for REJECTED is the transition handler's job (§1.3)
    const { breakdown } = calculateScore(makeInput({ verificationStatus: REJECTED }), 'STATUS_TRANSITION')
    expect(breakdown.S4_adminApproved).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SIGNAL S5 — Description Length  §2.1
// ─────────────────────────────────────────────────────────────

describe('S5 — description of sufficient length (≥ 50 chars)', () => {
  it('description of exactly 50 characters earns S5 (0.10)', () => {
    const desc = 'A'.repeat(50)
    const { breakdown } = calculateScore(makeInput({ description: desc }), 'FIELD_UPDATED')
    expect(breakdown.S5_description).toBe(0.10)
  })

  it('description longer than 50 characters earns S5', () => {
    const desc = 'A'.repeat(120)
    const { breakdown } = calculateScore(makeInput({ description: desc }), 'FIELD_UPDATED')
    expect(breakdown.S5_description).toBe(0.10)
  })

  it('description of 49 characters does not earn S5', () => {
    const desc = 'A'.repeat(49)
    const { breakdown } = calculateScore(makeInput({ description: desc }), 'FIELD_UPDATED')
    expect(breakdown.S5_description).toBe(0)
  })

  it('null description does not earn S5', () => {
    const { breakdown } = calculateScore(makeInput({ description: null }), 'FIELD_UPDATED')
    expect(breakdown.S5_description).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SIGNAL S6 — Street-Level Address  §2.1
// ─────────────────────────────────────────────────────────────

describe('S6 — street-level address (≥ 20 chars)', () => {
  it('address of exactly 20 characters earns S6 (0.10)', () => {
    const { breakdown } = calculateScore(makeInput({ address: '14 Ahmadu Bello Way,' }), 'FIELD_UPDATED')
    expect(breakdown.S6_detailedAddress).toBe(0.10)
  })

  it('address longer than 20 characters earns S6', () => {
    const { breakdown } = calculateScore(makeInput({ address: '14 Ahmadu Bello Way, VI' }), 'FIELD_UPDATED')
    expect(breakdown.S6_detailedAddress).toBe(0.10)
  })

  it('address of 19 characters does not earn S6', () => {
    // Spec example: "14 Ahmadu Bello Way" = 19 chars → does not qualify
    const { breakdown } = calculateScore(makeInput({ address: '14 Ahmadu Bello Way' }), 'FIELD_UPDATED')
    expect(breakdown.S6_detailedAddress).toBe(0)
    expect('14 Ahmadu Bello Way'.length).toBe(19)
  })

  it('empty address does not earn S6', () => {
    const { breakdown } = calculateScore(makeInput({ address: '' }), 'FIELD_UPDATED')
    expect(breakdown.S6_detailedAddress).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SIGNAL S7 — Contact Channel  §2.1
// ─────────────────────────────────────────────────────────────

describe('S7 — contact channel present (website or email)', () => {
  it('non-empty website earns S7 (0.05)', () => {
    const { breakdown } = calculateScore(makeInput({ website: 'https://example.com' }), 'FIELD_UPDATED')
    expect(breakdown.S7_contactChannel).toBe(0.05)
  })

  it('non-empty email earns S7', () => {
    const { breakdown } = calculateScore(makeInput({ email: 'info@restaurant.com' }), 'FIELD_UPDATED')
    expect(breakdown.S7_contactChannel).toBe(0.05)
  })

  it('both website and email present earns S7 only once — no double-counting', () => {
    const { breakdown } = calculateScore(
      makeInput({ website: 'https://example.com', email: 'info@restaurant.com' }),
      'FIELD_UPDATED',
    )
    expect(breakdown.S7_contactChannel).toBe(0.05)
  })

  it('null website and null email do not earn S7', () => {
    const { breakdown } = calculateScore(makeInput({ website: null, email: null }), 'FIELD_UPDATED')
    expect(breakdown.S7_contactChannel).toBe(0)
  })

  it('empty string website does not earn S7', () => {
    const { breakdown } = calculateScore(makeInput({ website: '' }), 'FIELD_UPDATED')
    expect(breakdown.S7_contactChannel).toBe(0)
  })

  it('empty string email does not earn S7', () => {
    const { breakdown } = calculateScore(makeInput({ email: '' }), 'FIELD_UPDATED')
    expect(breakdown.S7_contactChannel).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SIGNAL INDEPENDENCE  §2.2
// ─────────────────────────────────────────────────────────────

describe('signal independence — §2.2', () => {
  it('S1 + S3 + S4 = 0.600 regardless of other signals', () => {
    const { score } = calculateScore(
      makeInput({
        phone: '08012345678',
        activeDishCount: 3,
        verificationStatus: APPROVED,
      }),
      'STATUS_TRANSITION',
    )
    expect(score).toBe(0.6)
  })

  it('zero signals earned gives score 0.000', () => {
    const { score } = calculateScore(makeInput(), 'STATUS_TRANSITION')
    expect(score).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// SPEC EXAMPLES  §8
// ─────────────────────────────────────────────────────────────

describe('spec examples — §8', () => {
  // Example A: bare submission at intake
  it('Example A — bare submission: score 0.300', () => {
    const { score, breakdown } = calculateScore(
      makeInput({
        phone: '08012345678',             // S1 ✓  +0.200
        description: 'A'.repeat(35),      // S5 ✗  35 < 50
        address: '14 Broad Street, Lagos',// S6 ✓  24 chars
        verifiedPhotoCount: 0,            // S2 ✗
        activeDishCount: 1,               // S3 ✗
        verificationStatus: PENDING_REVIEW,// S4 ✗
        website: null,                    // S7 ✗
      }),
      'STATUS_TRANSITION',
    )
    expect(score).toBe(0.3)
    expect(breakdown.S1_phoneValid).toBe(0.20)
    expect(breakdown.S2_verifiedPhoto).toBe(0)
    expect(breakdown.S3_threeDishes).toBe(0)
    expect(breakdown.S4_adminApproved).toBe(0)
    expect(breakdown.S5_description).toBe(0)
    expect(breakdown.S6_detailedAddress).toBe(0.10)
    expect(breakdown.S7_contactChannel).toBe(0)
    expect('14 Broad Street, Lagos'.length).toBe(22)
  })

  // Example B: well-prepared submission before approval
  it('Example B — well-prepared before approval: score 0.600', () => {
    const { score, breakdown } = calculateScore(
      makeInput({
        phone: '08012345678',            // S1 ✓  +0.200
        verifiedPhotoCount: 0,           // S2 ✗  photos uploaded but none verified
        activeDishCount: 5,              // S3 ✓  +0.150
        verificationStatus: PENDING_REVIEW, // S4 ✗
        description: 'A'.repeat(120),   // S5 ✓  +0.100
        address: 'A'.repeat(45),        // S6 ✓  +0.100
        website: 'https://example.com', // S7 ✓  +0.050
      }),
      'STATUS_TRANSITION',
    )
    expect(score).toBe(0.6)
    expect(breakdown.S4_adminApproved).toBe(0)
  })

  // Example C: post-approval, all signals
  it('Example C — post-approval all signals: score 1.000', () => {
    const { score, breakdown } = calculateScore(
      makeInput({
        phone: '08012345678',            // S1 ✓
        verifiedPhotoCount: 2,           // S2 ✓
        activeDishCount: 5,              // S3 ✓
        verificationStatus: APPROVED,   // S4 ✓
        description: 'A'.repeat(120),   // S5 ✓
        address: 'A'.repeat(45),        // S6 ✓
        website: 'https://example.com', // S7 ✓
      }),
      'STATUS_TRANSITION',
    )
    expect(score).toBe(1)
    expect(breakdown.total).toBe(1)
  })

  // Example D: pre-approval state (S1 + S5 + S6 = 0.400)
  it('Example D — pre-approval state: score 0.400', () => {
    const { score } = calculateScore(
      makeInput({
        phone: '08012345678',      // S1 ✓  +0.200
        description: 'A'.repeat(60), // S5 ✓  +0.100
        address: 'A'.repeat(25),   // S6 ✓  +0.100
        verifiedPhotoCount: 0,     // S2 ✗
        activeDishCount: 2,        // S3 ✗  only 2 dishes
        verificationStatus: PENDING_REVIEW, // S4 ✗
        website: null,             // S7 ✗
      }),
      'STATUS_TRANSITION',
    )
    expect(score).toBe(0.4)
  })

  // Example E: minimal listing — only S7
  it('Example E — contact only: score 0.050', () => {
    const { score } = calculateScore(
      makeInput({
        phone: null,           // S1 ✗
        verifiedPhotoCount: 0, // S2 ✗
        activeDishCount: 1,    // S3 ✗
        verificationStatus: PENDING_REVIEW, // S4 ✗
        description: 'A'.repeat(30), // S5 ✗  30 < 50
        address: '',           // S6 ✗
        website: 'https://restaurant.ng', // S7 ✓  +0.050
      }),
      'STATUS_TRANSITION',
    )
    expect(score).toBe(0.05)
  })

  // Example F: APPROVED → NEEDS_INFO — S4 is lost, score drops
  it('Example F — APPROVED→NEEDS_INFO transition drops S4: 0.650 → 0.400', () => {
    // Pre-correction: APPROVED with S1 + S5 + S6 + S4
    const preInput = makeInput({
      phone: '08012345678',
      description: 'A'.repeat(60),
      address: 'A'.repeat(25),
      verificationStatus: APPROVED,
      verifiedPhotoCount: 0,
      activeDishCount: 0,
    })
    const { score: preScore } = calculateScore(preInput, 'STATUS_TRANSITION')
    expect(preScore).toBe(0.65)

    // Post-correction: same restaurant, now NEEDS_INFO — S4 no longer earned
    const postInput = { ...preInput, verificationStatus: NEEDS_INFO }
    const { score: postScore } = calculateScore(postInput, 'STATUS_TRANSITION')
    expect(postScore).toBe(0.4)
  })
})

// ─────────────────────────────────────────────────────────────
// SCORE PRECISION AND CLAMPING  §1.1
// ─────────────────────────────────────────────────────────────

describe('score precision and clamping', () => {
  it('score is always rounded to 3 decimal places', () => {
    const { score } = calculateScore(
      makeInput({ phone: '08012345678', verificationStatus: APPROVED }),
      'STATUS_TRANSITION',
    )
    const asString = score.toFixed(3)
    expect(parseFloat(asString)).toBe(score)
  })

  it('score 0.000 when no signals are earned', () => {
    const { score } = calculateScore(makeInput(), 'STATUS_TRANSITION')
    expect(score).toBe(0)
  })

  it('all-signals score is 1.000 — no floating-point overflow', () => {
    const { score } = calculateScore(
      makeInput({
        phone: '08012345678',
        verifiedPhotoCount: 1,
        activeDishCount: 3,
        verificationStatus: APPROVED,
        description: 'A'.repeat(50),
        address: 'A'.repeat(20),
        website: 'https://example.com',
      }),
      'STATUS_TRANSITION',
    )
    expect(score).toBe(1)
  })

  it('breakdown.total matches returned score', () => {
    const { score, breakdown } = calculateScore(
      makeInput({ phone: '08012345678', activeDishCount: 3 }),
      'DISH_ADDED',
    )
    expect(breakdown.total).toBe(score)
  })
})

// ─────────────────────────────────────────────────────────────
// BREAKDOWN STRUCTURE  §7.1, Appendix A
// ─────────────────────────────────────────────────────────────

describe('breakdown structure', () => {
  it('contains all 7 signal keys plus total, calculatedAt, trigger', () => {
    const { breakdown } = calculateScore(makeInput(), 'STATUS_TRANSITION')
    expect(breakdown).toMatchObject({
      S1_phoneValid: expect.any(Number),
      S2_verifiedPhoto: expect.any(Number),
      S3_threeDishes: expect.any(Number),
      S4_adminApproved: expect.any(Number),
      S5_description: expect.any(Number),
      S6_detailedAddress: expect.any(Number),
      S7_contactChannel: expect.any(Number),
      total: expect.any(Number),
      calculatedAt: expect.stringMatching(ISO_PATTERN),
      trigger: 'STATUS_TRANSITION',
    })
  })

  it('calculatedAt is an ISO-8601 timestamp string', () => {
    const { breakdown } = calculateScore(makeInput(), 'PHOTO_VERIFIED')
    expect(ISO_PATTERN.test(breakdown.calculatedAt)).toBe(true)
  })

  it('trigger field reflects the provided trigger value', () => {
    const triggers = ['STATUS_TRANSITION', 'PHOTO_VERIFIED', 'DISH_ADDED', 'DISH_REMOVED', 'FIELD_UPDATED'] as const
    for (const trigger of triggers) {
      const { breakdown } = calculateScore(makeInput(), trigger)
      expect(breakdown.trigger).toBe(trigger)
    }
  })

  it('earned signal fields equal the full weight constant', () => {
    const { breakdown } = calculateScore(
      makeInput({ phone: '08012345678' }),
      'FIELD_UPDATED',
    )
    expect(breakdown.S1_phoneValid).toBe(SIGNAL_WEIGHTS.S1_phoneValid)
  })

  it('un-earned signal fields are 0 (not null, not undefined)', () => {
    const { breakdown } = calculateScore(makeInput(), 'FIELD_UPDATED')
    const signalKeys = [
      'S1_phoneValid', 'S2_verifiedPhoto', 'S3_threeDishes', 'S4_adminApproved',
      'S5_description', 'S6_detailedAddress', 'S7_contactChannel',
    ] as const
    for (const key of signalKeys) {
      expect(breakdown[key]).toBe(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// CONVENIENCE WRAPPERS
// ─────────────────────────────────────────────────────────────

describe('calculateConfidenceScore', () => {
  it('returns the same score as calculateScore', () => {
    const input = makeInput({ phone: '08012345678' })
    expect(calculateConfidenceScore(input)).toBe(calculateScore(input, 'FIELD_UPDATED').score)
  })
})

describe('getScoreBreakdown', () => {
  it('returns a breakdown with the provided trigger', () => {
    const breakdown = getScoreBreakdown(makeInput(), 'DISH_ADDED')
    expect(breakdown.trigger).toBe('DISH_ADDED')
  })
})

// ─────────────────────────────────────────────────────────────
// simulateApprovalScore  §4.2
// ─────────────────────────────────────────────────────────────

describe('simulateApprovalScore', () => {
  it('adds S4 weight even when current status is PENDING_REVIEW', () => {
    const input = makeInput({ verificationStatus: PENDING_REVIEW })
    const actual = calculateConfidenceScore(input)
    const simulated = simulateApprovalScore(input)
    expect(simulated - actual).toBeCloseTo(SIGNAL_WEIGHTS.S4_adminApproved, 5)
  })

  it('adds S4 weight when current status is NEEDS_INFO', () => {
    const input = makeInput({ verificationStatus: NEEDS_INFO })
    const simulated = simulateApprovalScore(input)
    expect(simulated).toBe(SIGNAL_WEIGHTS.S4_adminApproved)
  })

  it('adds S4 weight when current status is DRAFT', () => {
    const input = makeInput({ verificationStatus: DRAFT })
    const simulated = simulateApprovalScore(input)
    expect(simulated).toBe(SIGNAL_WEIGHTS.S4_adminApproved)
  })

  it('score is 1.000 when all non-S4 signals earned + simulation', () => {
    const input = makeInput({
      phone: '08012345678',
      verifiedPhotoCount: 1,
      activeDishCount: 3,
      verificationStatus: PENDING_REVIEW,
      description: 'A'.repeat(50),
      address: 'A'.repeat(20),
      website: 'https://example.com',
    })
    expect(simulateApprovalScore(input)).toBe(1)
  })

  it('does not mutate the original input object', () => {
    const input = makeInput({ verificationStatus: PENDING_REVIEW })
    simulateApprovalScore(input)
    expect(input.verificationStatus).toBe(PENDING_REVIEW)
  })

  it('Example D — pre-approval 0.400 simulates to 0.650', () => {
    const input = makeInput({
      phone: '08012345678',
      description: 'A'.repeat(60),
      address: 'A'.repeat(25),
      verificationStatus: PENDING_REVIEW,
    })
    expect(simulateApprovalScore(input)).toBe(0.65)
  })

  it('Example E — pre-approval 0.050 simulates to 0.300', () => {
    const input = makeInput({
      website: 'https://restaurant.ng',
      verificationStatus: PENDING_REVIEW,
    })
    expect(simulateApprovalScore(input)).toBe(0.3)
  })
})

// ─────────────────────────────────────────────────────────────
// evaluateApprovalThreshold  §4.1, §4.2, Appendix C
// ─────────────────────────────────────────────────────────────

describe('evaluateApprovalThreshold', () => {
  it('Example D: simulated 0.650 ≥ 0.400 → passes', () => {
    const input = makeInput({
      phone: '08012345678',
      description: 'A'.repeat(60),
      address: 'A'.repeat(25),
      verificationStatus: PENDING_REVIEW,
    })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(true)
    expect(result.simulatedScore).toBe(0.65)
  })

  it('Example E: simulated 0.300 < 0.400 → blocked with SCORE_BELOW_THRESHOLD', () => {
    const input = makeInput({ website: 'https://restaurant.ng' })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(false)
    if (!result.passes) {
      expect(result.code).toBe('SCORE_BELOW_THRESHOLD')
      expect(result.simulatedScore).toBe(0.3)
    }
  })

  it('S2 alone (0.150) + S4 (0.250) = exactly 0.400 → passes (Appendix C)', () => {
    const input = makeInput({ verifiedPhotoCount: 1 })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(true)
    expect(result.simulatedScore).toBe(0.4)
  })

  it('S3 alone (0.150) + S4 (0.250) = exactly 0.400 → passes (Appendix C)', () => {
    const input = makeInput({ activeDishCount: 3 })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(true)
    expect(result.simulatedScore).toBe(0.4)
  })

  it('S1 alone (0.200) + S4 (0.250) = 0.450 → passes', () => {
    const input = makeInput({ phone: '08012345678' })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(true)
    expect(result.simulatedScore).toBe(0.45)
  })

  it('S7 alone (0.050) + S4 (0.250) = 0.300 → blocked (Appendix C)', () => {
    const input = makeInput({ website: 'https://example.com' })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(false)
    expect(result.simulatedScore).toBe(0.3)
  })

  it('S5 alone (0.100) + S4 (0.250) = 0.350 → blocked', () => {
    const input = makeInput({ description: 'A'.repeat(50) })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(false)
    expect(result.simulatedScore).toBe(0.35)
  })

  it('S6 alone (0.100) + S4 (0.250) = 0.350 → blocked', () => {
    const input = makeInput({ address: 'A'.repeat(20) })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(false)
    expect(result.simulatedScore).toBe(0.35)
  })

  it('S5 + S6 (0.200) + S4 (0.250) = 0.450 → passes', () => {
    const input = makeInput({
      description: 'A'.repeat(50),
      address: 'A'.repeat(20),
    })
    const result = evaluateApprovalThreshold(input)
    expect(result.passes).toBe(true)
    expect(result.simulatedScore).toBe(0.45)
  })

  it('returns simulatedScore on both passing and failing paths', () => {
    const passing = evaluateApprovalThreshold(makeInput({ phone: '08012345678' }))
    expect(typeof passing.simulatedScore).toBe('number')

    const failing = evaluateApprovalThreshold(makeInput())
    expect(typeof failing.simulatedScore).toBe('number')
  })
})

// ─────────────────────────────────────────────────────────────
// validateOverrideRequest  §6.1, §6.2
// ─────────────────────────────────────────────────────────────

describe('validateOverrideRequest', () => {
  const validArgs = {
    score: 0.750,
    reason: 'Physical inspection confirmed quality.',
    actorRole: SUPER,
    currentStatus: APPROVED,
  } as const

  it('SUPER with valid score and reason returns { valid: true }', () => {
    const result = validateOverrideRequest(
      validArgs.score, validArgs.reason, validArgs.actorRole, validArgs.currentStatus,
    )
    expect(result.valid).toBe(true)
  })

  // Role checks
  it('ADMIN role → UNAUTHORIZED_ACTOR', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, ADMIN, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  it('USER role → UNAUTHORIZED_ACTOR', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, USER, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  it('SYSTEM role → UNAUTHORIZED_ACTOR', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, SYSTEM, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  // Status check
  it('DRAFT status → OVERRIDE_NOT_ALLOWED_IN_DRAFT', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, SUPER, DRAFT)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('OVERRIDE_NOT_ALLOWED_IN_DRAFT')
  })

  it('PENDING_REVIEW status → valid', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, SUPER, PENDING_REVIEW)
    expect(result.valid).toBe(true)
  })

  it('NEEDS_INFO status → valid', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, SUPER, NEEDS_INFO)
    expect(result.valid).toBe(true)
  })

  it('APPROVED status → valid', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, SUPER, APPROVED)
    expect(result.valid).toBe(true)
  })

  it('REJECTED status → valid', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, SUPER, REJECTED)
    expect(result.valid).toBe(true)
  })

  // Reason checks
  it('reason exactly 10 characters → valid', () => {
    const result = validateOverrideRequest(0.5, '1234567890', SUPER, APPROVED)
    expect(result.valid).toBe(true)
  })

  it('reason of 9 characters → REASON_TOO_SHORT', () => {
    const result = validateOverrideRequest(0.5, '123456789', SUPER, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('REASON_TOO_SHORT')
  })

  it('empty reason → REASON_TOO_SHORT', () => {
    const result = validateOverrideRequest(0.5, '', SUPER, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('REASON_TOO_SHORT')
  })

  // Score range checks
  it('score 0.000 → valid (minimum boundary)', () => {
    const result = validateOverrideRequest(0, validArgs.reason, SUPER, APPROVED)
    expect(result.valid).toBe(true)
  })

  it('score 1.000 → valid (maximum boundary)', () => {
    const result = validateOverrideRequest(1, validArgs.reason, SUPER, APPROVED)
    expect(result.valid).toBe(true)
  })

  it('score 0.500 → valid (midpoint)', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, SUPER, APPROVED)
    expect(result.valid).toBe(true)
  })

  it('score -0.001 → SCORE_OUT_OF_RANGE', () => {
    const result = validateOverrideRequest(-0.001, validArgs.reason, SUPER, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('SCORE_OUT_OF_RANGE')
  })

  it('score 1.001 → SCORE_OUT_OF_RANGE', () => {
    const result = validateOverrideRequest(1.001, validArgs.reason, SUPER, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('SCORE_OUT_OF_RANGE')
  })

  // Error shapes
  it('invalid result includes a non-empty reason string', () => {
    const result = validateOverrideRequest(0.5, validArgs.reason, ADMIN, APPROVED)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('role check fires before status check', () => {
    // ADMIN in DRAFT — should get UNAUTHORIZED_ACTOR, not OVERRIDE_NOT_ALLOWED_IN_DRAFT
    const result = validateOverrideRequest(0.5, validArgs.reason, ADMIN, DRAFT)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('UNAUTHORIZED_ACTOR')
  })

  it('status check fires before reason check', () => {
    // SUPER + DRAFT + short reason — should get OVERRIDE_NOT_ALLOWED_IN_DRAFT, not REASON_TOO_SHORT
    const result = validateOverrideRequest(0.5, 'short', SUPER, DRAFT)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('OVERRIDE_NOT_ALLOWED_IN_DRAFT')
  })
})

// ─────────────────────────────────────────────────────────────
// buildOverrideBreakdown  §6.4
// ─────────────────────────────────────────────────────────────

describe('buildOverrideBreakdown', () => {
  const exampleLastBreakdown: SignalBreakdown = {
    S1_phoneValid: 0.20,
    S2_verifiedPhoto: 0,
    S3_threeDishes: 0.15,
    S4_adminApproved: 0.25,
    S5_description: 0.10,
    S6_detailedAddress: 0.10,
    S7_contactChannel: 0.05,
    total: 0.85,
  }

  it('sets overridden: true', () => {
    const result = buildOverrideBreakdown({
      overriddenBy: 'super-user-id',
      overrideScore: 0.750,
      overrideReason: 'Physical inspection confirmed quality.',
      lastComputedBreakdown: exampleLastBreakdown,
    })
    expect(result.overridden).toBe(true)
  })

  it('preserves overrideScore and overrideReason', () => {
    const result = buildOverrideBreakdown({
      overriddenBy: 'super-user-id',
      overrideScore: 0.750,
      overrideReason: 'Physical inspection confirmed quality.',
      lastComputedBreakdown: exampleLastBreakdown,
    })
    expect(result.overrideScore).toBe(0.750)
    expect(result.overrideReason).toBe('Physical inspection confirmed quality.')
  })

  it('preserves overriddenBy', () => {
    const result = buildOverrideBreakdown({
      overriddenBy: 'super-user-abc-123',
      overrideScore: 0.5,
      overrideReason: 'Offline evidence confirmed.',
      lastComputedBreakdown: exampleLastBreakdown,
    })
    expect(result.overriddenBy).toBe('super-user-abc-123')
  })

  it('includes lastComputedBreakdown matching the input', () => {
    const result = buildOverrideBreakdown({
      overriddenBy: 'super-user-id',
      overrideScore: 0.750,
      overrideReason: 'Physical inspection confirmed quality.',
      lastComputedBreakdown: exampleLastBreakdown,
    })
    expect(result.lastComputedBreakdown).toEqual(exampleLastBreakdown)
  })

  it('overriddenAt is an ISO-8601 timestamp string', () => {
    const result = buildOverrideBreakdown({
      overriddenBy: 'super-user-id',
      overrideScore: 0.5,
      overrideReason: 'Offline evidence confirmed.',
      lastComputedBreakdown: exampleLastBreakdown,
    })
    expect(ISO_PATTERN.test(result.overriddenAt)).toBe(true)
  })

  it('result shape matches spec §6.4 override marker structure', () => {
    const result = buildOverrideBreakdown({
      overriddenBy: 'super-user-id',
      overrideScore: 0.750,
      overrideReason: 'Physical inspection confirmed quality.',
      lastComputedBreakdown: exampleLastBreakdown,
    })
    expect(result).toMatchObject({
      overridden: true,
      overriddenAt: expect.stringMatching(ISO_PATTERN),
      overriddenBy: expect.any(String),
      overrideScore: expect.any(Number),
      overrideReason: expect.any(String),
      lastComputedBreakdown: expect.objectContaining({ total: expect.any(Number) }),
    })
  })
})

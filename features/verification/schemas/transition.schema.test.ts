import { describe, it, expect } from 'vitest'
import {
  ApproveActionSchema,
  RejectActionSchema,
  NeedsInfoActionSchema,
  AssignActionSchema,
  ScoreOverrideSchema,
} from './transition.schema'

// ─────────────────────────────────────────────────────────────
// ApproveActionSchema
// ─────────────────────────────────────────────────────────────

describe('ApproveActionSchema', () => {
  it('accepts empty object (notes is optional)', () => {
    expect(ApproveActionSchema.safeParse({}).success).toBe(true)
  })

  it('accepts notes when provided', () => {
    const r = ApproveActionSchema.safeParse({ notes: 'Looks good' })
    expect(r.success).toBe(true)
    expect(r.data?.notes).toBe('Looks good')
  })

  it('trims whitespace from notes', () => {
    const r = ApproveActionSchema.safeParse({ notes: '  Great photos  ' })
    expect(r.data?.notes).toBe('Great photos')
  })

  it('rejects notes exceeding 1000 characters', () => {
    const r = ApproveActionSchema.safeParse({ notes: 'a'.repeat(1001) })
    expect(r.success).toBe(false)
  })

  it('accepts notes at exactly 1000 characters', () => {
    expect(ApproveActionSchema.safeParse({ notes: 'a'.repeat(1000) }).success).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// RejectActionSchema
// ─────────────────────────────────────────────────────────────

describe('RejectActionSchema', () => {
  it('accepts a valid reason', () => {
    const r = RejectActionSchema.safeParse({ reason: 'Photos are blurry and unclear.' })
    expect(r.success).toBe(true)
  })

  it('rejects when reason is absent', () => {
    expect(RejectActionSchema.safeParse({}).success).toBe(false)
  })

  it('rejects reason shorter than 10 characters', () => {
    const r = RejectActionSchema.safeParse({ reason: 'Too short' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toContain('reason')
  })

  it('accepts reason at exactly 10 characters', () => {
    expect(RejectActionSchema.safeParse({ reason: '1234567890' }).success).toBe(true)
  })

  it('rejects empty string', () => {
    expect(RejectActionSchema.safeParse({ reason: '' }).success).toBe(false)
  })

  it('rejects reason exceeding 1000 characters', () => {
    expect(RejectActionSchema.safeParse({ reason: 'a'.repeat(1001) }).success).toBe(false)
  })

  it('trims whitespace and then validates minimum length', () => {
    // "   " trims to "" which is < 10 chars
    expect(RejectActionSchema.safeParse({ reason: '   ' }).success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// NeedsInfoActionSchema
// ─────────────────────────────────────────────────────────────

describe('NeedsInfoActionSchema', () => {
  it('accepts valid feedback', () => {
    const r = NeedsInfoActionSchema.safeParse({
      feedbackToSubmitter: 'Please provide clearer photos of the entrance.',
    })
    expect(r.success).toBe(true)
  })

  it('rejects when feedbackToSubmitter is absent', () => {
    expect(NeedsInfoActionSchema.safeParse({}).success).toBe(false)
  })

  it('rejects feedback shorter than 10 characters', () => {
    expect(NeedsInfoActionSchema.safeParse({ feedbackToSubmitter: 'Too short' }).success).toBe(false)
  })

  it('accepts feedback at exactly 10 characters', () => {
    expect(NeedsInfoActionSchema.safeParse({ feedbackToSubmitter: '1234567890' }).success).toBe(true)
  })

  it('rejects feedback exceeding 2000 characters', () => {
    expect(
      NeedsInfoActionSchema.safeParse({ feedbackToSubmitter: 'a'.repeat(2001) }).success,
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// AssignActionSchema
// ─────────────────────────────────────────────────────────────

describe('AssignActionSchema', () => {
  it('accepts a valid UUID', () => {
    const r = AssignActionSchema.safeParse({ adminId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789' })
    expect(r.success).toBe(true)
  })

  it('accepts null (un-assign)', () => {
    const r = AssignActionSchema.safeParse({ adminId: null })
    expect(r.success).toBe(true)
    expect(r.data?.adminId).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(AssignActionSchema.safeParse({ adminId: '' }).success).toBe(false)
  })

  it('rejects a non-UUID string', () => {
    expect(AssignActionSchema.safeParse({ adminId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects when adminId is absent', () => {
    expect(AssignActionSchema.safeParse({}).success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// ScoreOverrideSchema
// ─────────────────────────────────────────────────────────────

describe('ScoreOverrideSchema', () => {
  const VALID = { score: 0.75, reason: 'Manually verified on-site inspection.' }

  it('accepts a valid override', () => {
    expect(ScoreOverrideSchema.safeParse(VALID).success).toBe(true)
  })

  it('accepts score of exactly 0', () => {
    expect(ScoreOverrideSchema.safeParse({ ...VALID, score: 0 }).success).toBe(true)
  })

  it('accepts score of exactly 1', () => {
    expect(ScoreOverrideSchema.safeParse({ ...VALID, score: 1 }).success).toBe(true)
  })

  it('rejects score below 0', () => {
    expect(ScoreOverrideSchema.safeParse({ ...VALID, score: -0.001 }).success).toBe(false)
  })

  it('rejects score above 1', () => {
    expect(ScoreOverrideSchema.safeParse({ ...VALID, score: 1.001 }).success).toBe(false)
  })

  it('rejects reason shorter than 10 characters', () => {
    expect(ScoreOverrideSchema.safeParse({ ...VALID, reason: 'Short' }).success).toBe(false)
  })

  it('accepts reason at exactly 10 characters', () => {
    expect(ScoreOverrideSchema.safeParse({ ...VALID, reason: '1234567890' }).success).toBe(true)
  })

  it('rejects missing score', () => {
    expect(ScoreOverrideSchema.safeParse({ reason: VALID.reason }).success).toBe(false)
  })

  it('rejects missing reason', () => {
    expect(ScoreOverrideSchema.safeParse({ score: VALID.score }).success).toBe(false)
  })

  it('rejects non-numeric score', () => {
    expect(ScoreOverrideSchema.safeParse({ ...VALID, score: '0.75' }).success).toBe(false)
  })
})

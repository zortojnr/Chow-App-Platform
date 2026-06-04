// Zod schemas for admin verification state-transition request bodies.
//
// Each schema maps to one admin API action. All are parsed in the route handler
// before being passed to VerificationService or IntelligenceService.
//
// String minimums are business constraints, not UX constraints:
//   - reason min 10: prevents empty or single-character rejection reasons
//   - feedbackToSubmitter min 10: ensures actionable feedback reaches submitters
//   - override reason min 10: matches OVERRIDE_REASON_MIN_LENGTH in confidence-score.service.ts
//
// Governed by: track-02-verification-intelligence.md §9.3, §9.4
//              backend-standards.md §4.2

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────
// APPROVE
// ─────────────────────────────────────────────────────────────

export const ApproveActionSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
})

export type ApproveActionInput = z.infer<typeof ApproveActionSchema>

// ─────────────────────────────────────────────────────────────
// REJECT
// ─────────────────────────────────────────────────────────────

export const RejectActionSchema = z.object({
  reason: z.string().trim().min(10, 'Rejection reason must be at least 10 characters').max(1000),
})

export type RejectActionInput = z.infer<typeof RejectActionSchema>

// ─────────────────────────────────────────────────────────────
// NEEDS-INFO
// ─────────────────────────────────────────────────────────────

export const NeedsInfoActionSchema = z.object({
  feedbackToSubmitter: z
    .string()
    .trim()
    .min(10, 'Feedback must be at least 10 characters')
    .max(2000),
})

export type NeedsInfoActionInput = z.infer<typeof NeedsInfoActionSchema>

// ─────────────────────────────────────────────────────────────
// ASSIGN
// ─────────────────────────────────────────────────────────────
// adminId: null = un-assign (remove any existing assignment)

export const AssignActionSchema = z.object({
  adminId: z.string().uuid().nullable(),
})

export type AssignActionInput = z.infer<typeof AssignActionSchema>

// ─────────────────────────────────────────────────────────────
// SCORE OVERRIDE  (SUPER only)
// ─────────────────────────────────────────────────────────────
// score range and reason minimum mirror confidence-score.service.ts constants
// (SCORE_MIN=0, SCORE_MAX=1, OVERRIDE_REASON_MIN_LENGTH=10).

export const ScoreOverrideSchema = z.object({
  score:  z.number().min(0, 'Score must be ≥ 0').max(1, 'Score must be ≤ 1'),
  reason: z.string().trim().min(10, 'Override reason must be at least 10 characters').max(1000),
})

export type ScoreOverrideInput = z.infer<typeof ScoreOverrideSchema>

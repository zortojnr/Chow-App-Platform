// Public API surface for the verification feature.
//
// Rule: admin services and route handlers import from HERE, not from individual
// service files inside features/verification/. This boundary ensures that the
// implementation details of how verification works (state machine transitions,
// confidence score calculation, token generation, email dispatch) remain
// invisible to consumers.
//
// What is exported:
//   - VerificationService      — orchestrator for all state transitions
//   - IntelligenceService      — added in Phase A3
//   - Score breakdown types    — appear in VerificationRecord.scoreBreakdown
//                                and are included in admin API responses
//
// What is NOT exported:
//   - state-machine internals  (validateTransition, ALLOWED_TRANSITIONS)
//   - confidence-score functions (calculateScore, evaluateApprovalThreshold, etc.)
//   - confidence-score constants (SIGNAL_WEIGHTS, APPROVAL_THRESHOLD, etc.)
//   - response-token-service   (token generation and validation are internal)
//   - notification-service     (email dispatch is internal)
//   - dbForVerification        (the privileged DB client must never leave this feature)
//
// Governed by: backend-standards.md §2.3 — cross-feature imports use this index.
// Architecture ref: Step 8 implementation plan — Phase A2.

// ─────────────────────────────────────────────────────────────
// VERIFICATION ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
// Sole authority for changing Restaurant.verificationStatus.
// Admin route handlers call this for approve, reject, needs-info, assign.

export { VerificationService } from './services/verification.service'

export type {
  ApproveParams,
  ApproveResult,
  RejectParams,
  RequestInfoParams,
  ProcessSubmitterResponseParams,
  AssignAdminParams,
} from './services/verification.service'

// ─────────────────────────────────────────────────────────────
// INTELLIGENCE SERVICE
// ─────────────────────────────────────────────────────────────
// Admin-driven enrichment of dish, photo, and restaurant data.
// Handles verifyDish, verifyPhoto, updateAvailability, updatePricing,
// recalculateRestaurantIntelligence, and overrideScore (SUPER only).

export { IntelligenceService } from './services/intelligence.service'

export type {
  VerifyDishParams,
  VerifyDishResult,
  VerifyPhotoParams,
  VerifyPhotoResult,
  UpdateAvailabilityParams,
  UpdatePricingParams,
  UpdateIntelligenceParams,
  UpdateIntelligenceResult,
  UpdateIntelligenceFields,
  OverrideScoreParams,
} from './services/intelligence.service'

// ─────────────────────────────────────────────────────────────
// SCORE BREAKDOWN TYPES
// ─────────────────────────────────────────────────────────────
// Appear in VerificationRecord.scoreBreakdown (Prisma Json column).
// Admin services cast the raw Json to these types when building responses.
// SignalBreakdown is a constituent of both StandardBreakdown and OverrideBreakdown.
// RecalculationTrigger is a constituent of StandardBreakdown.

export type {
  SignalBreakdown,
  StandardBreakdown,
  OverrideBreakdown,
  RecalculationTrigger,
} from './services/confidence-score.service'

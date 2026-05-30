# Chow Here — Verification System Track

**Status:** AUTHORITATIVE BLUEPRINT  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Documents:** master-architecture.md, backend-standards.md, security-standards.md, data-governance.md

---

## 0. PURPOSE

This track defines the complete design of the Restaurant Verification System — the mechanism that transforms a raw submission into a trusted, published listing.

Verification is the core trust mechanism. It is not a formality. It is the engineering implementation of the platform's central product guarantee: **every restaurant on Chow Here has been verified**.

This track governs the state machine, confidence scoring, audit trail, status transition rules, and the interfaces through which admins perform review. It does **not** cover the admin UI (that is the Admin Platform track) — but it defines the service layer that the admin UI must call.

**This is a blueprint, not implementation code.**

---

## 1. SYSTEM RESPONSIBILITIES

The Verification System owns exactly these responsibilities:

| Responsibility | Description |
|---|---|
| State machine | The canonical transitions between verification statuses |
| Status transition enforcement | Only this system may change `verificationStatus` on a Restaurant |
| Confidence scoring | Calculate and persist a trust score for each restaurant |
| Audit trail | Immutable event log of all status transitions |
| Feedback to submitter | Record and send admin feedback to submitters |
| Admin assignment | Track which admin is currently reviewing a submission |

It does **not** own:
- Admin UI pages (owned by Admin Platform)
- Public restaurant listing visibility (the listing system reads `verificationStatus`)
- Intake submission (owned by Restaurant Intake)
- Search indexing (the search system reads `verificationStatus` to filter)

---

## 2. THE STATE MACHINE

### 2.1 States

```
DRAFT            → Submission saved, not yet submitted for review
PENDING_REVIEW   → In the admin review queue
NEEDS_INFO       → Admin has requested more information from submitter
APPROVED         → Verified and published
REJECTED         → Declined and removed from public visibility
```

### 2.2 Allowed Transitions

```
DRAFT           → PENDING_REVIEW      (by: SYSTEM, on: intake submission complete)
PENDING_REVIEW  → APPROVED            (by: ADMIN)
PENDING_REVIEW  → NEEDS_INFO          (by: ADMIN)
PENDING_REVIEW  → REJECTED            (by: ADMIN)
NEEDS_INFO      → PENDING_REVIEW      (by: SYSTEM, on: submitter responds)
NEEDS_INFO      → REJECTED            (by: ADMIN, if no response after timeout)
APPROVED        → NEEDS_INFO          (by: ADMIN, if post-approval concerns arise)
APPROVED        → REJECTED            (by: ADMIN, with mandatory reason)
REJECTED        → PENDING_REVIEW      (by: ADMIN only — allows resubmission appeal)
```

### 2.3 Forbidden Transitions

Any transition not listed above is **forbidden**. The state machine must reject it with an error.

**Examples of explicitly forbidden transitions:**
- `DRAFT → APPROVED` — bypasses review entirely
- `REJECTED → APPROVED` — bypasses re-review
- `APPROVED → DRAFT` — would remove a published listing silently
- Any transition performed by code outside `verification.service.ts`

### 2.4 State Machine Implementation

The state machine is implemented as a pure function that takes current status + requested next status + actor role and returns a `TransitionResult`:

```typescript
type TransitionResult = 
  | { allowed: true }
  | { allowed: false; reason: string }
```

The state machine table is defined as a constant — not derived programmatically. This makes it auditable:

```typescript
// features/verification/services/state-machine.ts

const ALLOWED_TRANSITIONS: Record<VerificationStatus, {
  to: VerificationStatus
  allowedActors: Array<'SYSTEM' | 'ADMIN' | 'SUPER'>
}[]> = {
  DRAFT: [
    { to: 'PENDING_REVIEW', allowedActors: ['SYSTEM'] }
  ],
  PENDING_REVIEW: [
    { to: 'APPROVED', allowedActors: ['ADMIN', 'SUPER'] },
    { to: 'NEEDS_INFO', allowedActors: ['ADMIN', 'SUPER'] },
    { to: 'REJECTED', allowedActors: ['ADMIN', 'SUPER'] }
  ],
  NEEDS_INFO: [
    { to: 'PENDING_REVIEW', allowedActors: ['SYSTEM'] },
    { to: 'REJECTED', allowedActors: ['ADMIN', 'SUPER'] }
  ],
  APPROVED: [
    { to: 'NEEDS_INFO', allowedActors: ['ADMIN', 'SUPER'] },
    { to: 'REJECTED', allowedActors: ['ADMIN', 'SUPER'] }
  ],
  REJECTED: [
    { to: 'PENDING_REVIEW', allowedActors: ['ADMIN', 'SUPER'] }
  ]
}
```

---

## 3. CONFIDENCE SCORING

### 3.1 Purpose

The confidence score is a decimal value (0.000–1.000) that quantifies the reliability of a restaurant's listing data. It is used to:

- Rank search results among `APPROVED` restaurants (higher confidence = higher rank)
- Communicate data completeness to admins during review
- Drive the admin prioritization queue (incomplete records surface for attention)

### 3.2 Scoring Components

The confidence score is calculated from weighted signals:

| Signal | Weight | Earned When |
|---|---|---|
| Phone number provided and valid | 0.20 | `phone` is present and passes regex |
| At least 1 verified photo | 0.15 | `RestaurantPhoto.isVerified = true` |
| At least 3 dishes linked | 0.15 | 3+ active `RestaurantDish` records |
| Admin manually verified (APPROVED status) | 0.25 | `verificationStatus = APPROVED` |
| Description provided (≥50 chars) | 0.10 | `description.length >= 50` |
| Address is detailed (street-level) | 0.10 | `address.length >= 20` |
| Website or email present | 0.05 | `website OR email` is non-null |

**Total maximum score: 1.000**

### 3.3 Score Calculation

The score is calculated by `confidence-score.service.ts` and is always recalculated from scratch — never incremented. This prevents drift.

```typescript
// Pseudocode
function calculateConfidenceScore(restaurant: RestaurantWithRelations): number {
  let score = 0

  if (isValidPhone(restaurant.phone)) score += 0.20
  if (restaurant.photos.some(p => p.isVerified)) score += 0.15
  if (restaurant.dishes.filter(d => !d.deletedAt).length >= 3) score += 0.15
  if (restaurant.verificationStatus === 'APPROVED') score += 0.25
  if (restaurant.description && restaurant.description.length >= 50) score += 0.10
  if (restaurant.address && restaurant.address.length >= 20) score += 0.10
  if (restaurant.website || restaurant.email) score += 0.05

  return parseFloat(score.toFixed(3))
}
```

### 3.4 Score Persistence

The score is stored in two places (both kept in sync):
1. `VerificationRecord.confidenceScore` — the authoritative score record
2. `Restaurant.confidenceScore` — denormalized for fast query sorting

Both are updated every time the score is recalculated. The recalculation is triggered:
- On every status transition
- When an admin marks a photo as verified
- When a new dish is added or removed

---

## 4. THE AUDIT TRAIL

### 4.1 Immutability

`VerificationEvent` records are **append-only**. Once written, they are never updated or deleted. The Prisma client extension must reject any attempt to call `update` or `delete` on `VerificationEvent`.

### 4.2 Event Schema

Every status transition writes one `VerificationEvent`:

```typescript
{
  verificationRecordId: string    // FK to VerificationRecord
  restaurantId:         string    // Denormalized for direct query
  fromStatus:           VerificationStatus | null   // null on first event
  toStatus:             VerificationStatus
  reason:               string?   // Required for REJECTED, optional otherwise
  actorId:              string    // Admin user ID or "SYSTEM"
  actorRole:            UserRole  // Role at time of action
  ipAddress:            string    // Request IP, always captured
  createdAt:            DateTime  // Immutable timestamp
}
```

### 4.3 Events Written by the System

| Trigger | fromStatus | toStatus | actorId |
|---|---|---|---|
| Intake submission saved | null | DRAFT | SYSTEM |
| Intake submission queued | DRAFT | PENDING_REVIEW | SYSTEM |
| Admin approves | PENDING_REVIEW | APPROVED | admin.id |
| Admin requests info | PENDING_REVIEW | NEEDS_INFO | admin.id |
| Admin rejects | PENDING_REVIEW | REJECTED | admin.id |
| Submitter provides info | NEEDS_INFO | PENDING_REVIEW | SYSTEM |
| Timeout auto-reject | NEEDS_INFO | REJECTED | SYSTEM |

---

## 5. VERIFICATION WORKFLOW (ADMIN PERSPECTIVE)

This section describes what happens at each step from the admin's operational standpoint. The Admin Platform track builds the UI; this track defines what the service layer does.

### 5.1 Review Assignment

When an admin opens a submission in the review queue:
- `VerificationRecord.assignedTo` is set to the admin's user ID
- This is a soft assignment — it shows other admins who is reviewing, but does not lock the record
- Assignment is cleared on any status transition that exits `PENDING_REVIEW`

### 5.2 Approval Flow

When an admin approves a submission:
1. State machine validates: `PENDING_REVIEW → APPROVED` is allowed for this actor's role
2. `VerificationRecord.currentStatus` updated to `APPROVED`
3. `Restaurant.verificationStatus` updated to `APPROVED`
4. Confidence score recalculated and persisted
5. `VerificationEvent` written
6. `VerificationRecord.assignedTo` cleared
7. Notification email sent to submitter (if email on record)

### 5.3 Needs-Info Flow

When an admin requests more information:
1. Admin provides `feedbackToSubmitter` text (required for NEEDS_INFO transition)
2. State machine validates transition
3. `VerificationRecord.feedbackToSubmitter` updated
4. Status transitions to `NEEDS_INFO`
5. `VerificationEvent` written
6. Notification email sent to submitter with the feedback text

The submitter responds via a dedicated response URL (unique token link in the email). The response updates `VerificationRecord.internalNotes` with the submitter's response and triggers `NEEDS_INFO → PENDING_REVIEW`.

### 5.4 Rejection Flow

When an admin rejects a submission:
1. `reason` is **required** — cannot reject without a reason
2. State machine validates transition
3. `VerificationRecord.internalNotes` updated with reason
4. Status transitions to `REJECTED`
5. `VerificationEvent` written with reason
6. Notification email sent to submitter explaining rejection (reason is sanitized before sending — internal admin notes are never sent to submitters)

### 5.5 Post-Approval Corrections

Approved restaurants can be moved back to `NEEDS_INFO` if quality issues are discovered post-approval. This is expected behavior for maintaining trust. The transition is `APPROVED → NEEDS_INFO` and triggers the same feedback flow.

---

## 6. API ENDPOINT DEFINITIONS

All verification endpoints are admin-authenticated. The `ADMIN` or `SUPER` role is required.

### 6.1 POST /api/v1/admin/verification/:restaurantId/approve

**Auth:** ADMIN or SUPER  
**Body:** `{ notes?: string }`  
**Action:** Transition `→ APPROVED`, recalculate score, write event, notify submitter

### 6.2 POST /api/v1/admin/verification/:restaurantId/reject

**Auth:** ADMIN or SUPER  
**Body:** `{ reason: string }` (reason is required)  
**Action:** Transition `→ REJECTED`, write event, notify submitter

### 6.3 POST /api/v1/admin/verification/:restaurantId/needs-info

**Auth:** ADMIN or SUPER  
**Body:** `{ feedbackToSubmitter: string }` (required)  
**Action:** Transition `→ NEEDS_INFO`, write event, notify submitter

### 6.4 POST /api/v1/verification/respond/:token

**Auth:** None (token-based)  
**Body:** `{ responseText: string, additionalPhotos?: string[] }`  
**Action:** Validate token → transition `NEEDS_INFO → PENDING_REVIEW` → write event

**Token details:**
- The response token is a signed JWT with `{ restaurantId, verificationRecordId, exp }` 
- Tokens expire in 14 days
- Single-use: after a response is submitted, the token is invalidated (stored used-token hash in DB)

### 6.5 GET /api/v1/admin/verification/queue

**Auth:** ADMIN or SUPER  
**Query:** `?status=PENDING_REVIEW&page=1&limit=20&sortBy=createdAt`  
**Action:** Return paginated list of verification records in the given status

### 6.6 GET /api/v1/admin/verification/:restaurantId/history

**Auth:** ADMIN or SUPER  
**Action:** Return full `VerificationEvent` history for a restaurant

---

## 7. MODULE STRUCTURE

```
features/verification/
├── services/
│   ├── verification.service.ts        ← Orchestrator (calls all sub-services)
│   ├── state-machine.ts               ← Pure transition validation
│   ├── confidence-score.service.ts    ← Score calculation
│   ├── response-token.service.ts      ← Token generation/validation
│   └── notification.service.ts        ← Email trigger on transitions
├── schemas/
│   ├── transition.schema.ts           ← Zod: approve/reject/needs-info request bodies
│   └── response.schema.ts             ← Zod: submitter response form
└── types/
    └── verification.types.ts
```

**The `verification.service.ts` orchestrator is the ONLY module that directly updates `Restaurant.verificationStatus` and `VerificationRecord`. All other services call through it.**

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Role Enforcement

All admin verification endpoints enforce role at the route level:

```typescript
// Pattern for all admin verification routes
const session = await requireSession(request)
if (!['ADMIN', 'SUPER'].includes(session.user.role)) {
  return forbidden()
}
```

Middleware alone is insufficient. The role check must also be in the route handler.

### 8.2 State Transition Integrity

The state machine is called before any DB write. If the transition is invalid, the DB is never touched. This prevents partial state corruption.

All verification-related DB writes are wrapped in a Prisma transaction:

```typescript
await db.$transaction([
  db.restaurant.update({ where: { id }, data: { verificationStatus: toStatus } }),
  db.verificationRecord.update({ where: { restaurantId: id }, data: { currentStatus: toStatus } }),
  db.verificationEvent.create({ data: eventData }),
])
```

If any part of the transaction fails, all parts roll back.

### 8.3 Response Token Security

- Tokens are signed with `NEXTAUTH_SECRET` via `jose` (JWT library)
- Token payload contains `restaurantId` and `verificationRecordId` only — no PII
- Used token hashes stored in `UsedVerificationToken` table to prevent replay
- Token expiry is enforced at both JWT level and DB-lookup level

### 8.4 Admin Note Isolation

`VerificationRecord.internalNotes` is **never** returned in any public-facing API response. It is available only through admin-authenticated endpoints. Submitter notifications use only `feedbackToSubmitter`.

---

## 9. NEEDS-INFO TIMEOUT POLICY

Phase 1 timeout policy:

- Submissions that remain in `NEEDS_INFO` for 30 days with no submitter response are automatically transitioned to `REJECTED`
- This is run as a manual admin action in Phase 1 (admin triggers "clear stale" action in the admin dashboard)
- Phase 2 can automate this with a cron job if volume requires it

The manual approach avoids adding cron infrastructure to Phase 1.

---

## 10. IMPLEMENTATION SEQUENCE

### Step 1: State Machine
1. Write `ALLOWED_TRANSITIONS` constant
2. Write `validateTransition()` pure function
3. Write comprehensive unit tests — every transition, every role

### Step 2: Confidence Scoring
1. Write `calculateConfidenceScore()` pure function
2. Write unit tests with fixture restaurants
3. Verify scoring matches expected values

### Step 3: Core Service
1. Write `verification.service.ts` orchestrator
2. Wire state machine → DB transaction → event logging
3. Integration tests for each transition type

### Step 4: Response Token System
1. Write `response-token.service.ts`
2. Create `UsedVerificationToken` table migration
3. Test token generation, validation, and replay prevention

### Step 5: Notifications
1. Write React Email templates for each notification type
2. Wire `notification.service.ts` to each transition
3. Verify Resend integration in staging

### Step 6: API Endpoints
1. Implement all admin verification endpoints
2. Implement public response endpoint
3. Integration tests for each endpoint

### Step 7: Admin Platform Integration
1. Admin Platform Track builds UI on top of these endpoints
2. No verification logic in UI layer — service calls only

---

## 11. KNOWN RISKS AND EDGE CASES

| Risk | Mitigation |
|---|---|
| Admin transitions same restaurant simultaneously | Prisma transaction with row-level locking; last writer wins (acceptable for Phase 1) |
| Response token replayed | Used token hash stored in DB; second use returns 410 Gone |
| Score drift between `Restaurant` and `VerificationRecord` | Both updated in same transaction; if transaction fails, both roll back |
| Admin rejects without a reason | `reason` field required in Zod schema; API returns 422 if missing |
| `APPROVED → REJECTED` without logging | All transitions log to `VerificationEvent`; no transition skips logging |
| submitter email not provided at intake | Notifications are best-effort; no email if `submitterEmail` is null |

---

*Governed by master-architecture.md, backend-standards.md, and security-standards.md. All conflicts resolved by those documents.*

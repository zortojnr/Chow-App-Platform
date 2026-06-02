# Chow Here — Track 2: Restaurant Verification & Intelligence Collection System

**Status:** AUTHORITATIVE BLUEPRINT  
**Version:** 1.0  
**Last Updated:** 2026-05-31  
**Track Sequence:** 2 of N (follows database-track.md)  
**Parent Documents:** master-architecture.md · backend-standards.md · frontend-standards.md · security-standards.md · data-governance.md  
**Companion Blueprints:** restaurant-intake-track.md · verification-system-track.md · admin-platform-track.md

---

## 0. PURPOSE AND SCOPE

This document is the implementation governance document for Track 2. It synthesises the existing blueprint documents (restaurant-intake-track.md, verification-system-track.md, admin-platform-track.md) into a single, sequenced delivery plan and adds the Intelligence Collection layer that connects verification outcomes to search quality.

Track 2 delivers three tightly coupled systems in one track because they share a single service boundary, a single state machine, and a single data lifecycle:

| System | What It Delivers |
|---|---|
| Restaurant Intake | The public-facing submission form and its server pipeline |
| Verification Workflow | The state machine, confidence scoring, and audit trail |
| Intelligence Collection | Structured food data gathered by admins during and after verification |

**This document is a blueprint. No implementation code is produced here. The implementation sequence in §12 defines the exact order of work.**

---

## 1. BUSINESS OBJECTIVES

### 1.1 Primary Objective

Establish the trust pipeline: the end-to-end mechanism by which a raw public submission becomes a verified, intelligence-enriched restaurant listing that earns a place in search results.

Every objective below is subordinate to this one.

### 1.2 Delivery Objectives

| ID | Objective | Success Condition |
|---|---|---|
| BO-1 | Capture restaurant submissions from the public | Submission form live; anonymous and authenticated submissions accepted |
| BO-2 | Route every submission through human admin review | No restaurant reaches `APPROVED` status without an admin decision |
| BO-3 | Produce a confidence score for every approved listing | Every `APPROVED` restaurant has a `confidenceScore` ≥ 0.40 |
| BO-4 | Enable admins to request additional information | `NEEDS_INFO` flow operational; submitter response mechanism functional |
| BO-5 | Collect structured dish intelligence during verification | Every approved restaurant has ≥ 1 verified dish; pricing and availability are recorded |
| BO-6 | Produce an immutable audit trail for all admin actions | Every state transition has a corresponding `VerificationEvent` record |
| BO-7 | Notify submitters at key milestones | Email sent on: submission confirmation, needs-info request, approval, rejection |
| BO-8 | Prevent trust-diluting data from reaching search | Only `APPROVED` restaurants with a valid confidence score appear in search results |

### 1.3 What This Track Does Not Deliver

The following are explicitly out of scope for Track 2:

- Public-facing restaurant listing pages (Track 3: Restaurant Listing System)
- Dish search and discovery (Track 4: Search System)
- User accounts and saved dishes (Track 5: User System)
- Admin analytics and reporting dashboards (Track 6: Admin Platform)
- Automated NEEDS_INFO timeout cron jobs (Phase 2)
- Restaurateur self-service portals

---

## 2. USER ROLES

Track 2 involves four distinct actors. Their permissions are precisely scoped.

### 2.1 Role Definitions

| Role | Identity | How They Enter the System |
|---|---|---|
| **Anonymous Submitter** | A member of the public submitting a restaurant they know | Public intake form; no account required |
| **Authenticated Submitter** | A logged-in user submitting a restaurant | Public intake form; session-identified |
| **Admin** | Internal team member reviewing submissions | Admin dashboard; `ADMIN` role required |
| **Super** | Platform owner with full system access | Admin dashboard; `SUPER` role required |

The `SYSTEM` actor is not a human. It is the identifier used in `VerificationEvent` records for machine-initiated transitions (submission queue entry, response callbacks, timeout rejections).

### 2.2 Role Capability Matrix

| Action | Anon | Auth User | Admin | Super |
|---|---|---|---|---|
| Submit a restaurant | ✅ | ✅ | ✅ | ✅ |
| Edit own DRAFT submission | ✅* | ✅* | ✅ | ✅ |
| Edit own NEEDS_INFO submission | ✅* | ✅* | ✅ | ✅ |
| Respond to NEEDS_INFO request | ✅ (token) | ✅ (token) | ✅ | ✅ |
| View their own submission status | ❌** | ✅ | ✅ | ✅ |
| View admin review queue | ❌ | ❌ | ✅ | ✅ |
| Assign self to a review | ❌ | ❌ | ✅ | ✅ |
| Approve a submission | ❌ | ❌ | ✅ | ✅ |
| Request more information | ❌ | ❌ | ✅ | ✅ |
| Reject a submission | ❌ | ❌ | ✅ | ✅ |
| Verify a dish | ❌ | ❌ | ✅ | ✅ |
| Verify a photo | ❌ | ❌ | ✅ | ✅ |
| Edit restaurant intelligence fields | ❌ | ❌ | ✅ | ✅ |
| Re-open a rejected submission | ❌ | ❌ | ✅ | ✅ |
| Override confidence score | ❌ | ❌ | ❌ | ✅ |
| Hard-delete any record | ❌ | ❌ | ❌ | ✅ |
| View verification event history | ❌ | ❌ | ✅ | ✅ |
| View internal admin notes | ❌ | ❌ | ✅ | ✅ |

\* Anonymous submitters can edit via the unique submission link sent in their confirmation email. Editing is locked once status moves to `PENDING_REVIEW`.  
\*\* Anonymous submitters have no account to check status through; they rely on email notifications.

### 2.3 Role Enforcement Points

Role enforcement occurs at two mandatory points — both must be present:

1. **Next.js Middleware** — blocks `/admin/*` routes from non-ADMIN/SUPER sessions at the router level
2. **Route Handler** — re-checks role on every admin API call; trusts only the server-side session

Middleware is the first gate. The route handler is the second gate. Removing either gate is a security violation (see security-standards.md §3.4).

---

## 3. RESTAURANT ONBOARDING WORKFLOW

Onboarding is the public-facing path from "someone knows about a restaurant" to "that restaurant is in the admin review queue."

### 3.1 Onboarding Entry Points

| Entry Point | Actor | Path |
|---|---|---|
| Public intake form | Anonymous or authenticated user | `/submit` |
| Admin-initiated submission | Admin on behalf of a known restaurant | Admin dashboard → "Add Restaurant" |

Both entry points use the same backend pipeline. Admin-initiated submissions bypass the rate limit check but go through identical validation.

### 3.2 Three-Step Intake Form

The public form is a multi-step wizard. Each step must be completable independently; data is held in client state and submitted as a single payload at the end.

**Step 1 — Restaurant Identity**
- Name, description
- Address, city (from enum), state (from enum), area (optional)
- Phone (Nigerian format), email, website (both optional)
- Price range (BUDGET / MID / UPSCALE)
- Cuisine types (free text, 1–5 items)

**Step 2 — Dish Association**
- Search the DishTaxonomy with a live typeahead (`GET /api/v1/intake/dishes?q=`)
- Select 1–50 dishes from canonical taxonomy
- For each dish: optionally set `nameAsServed`, `description`, `price`, and `availabilityStatus`
- Dishes not found in the taxonomy: the submitter notes the name in `submitterNote`; admin creates the taxonomy entry during review

**Step 3 — Photos**
- Upload 0–5 photos
- Each photo uploaded independently via `POST /api/v1/intake/photos` before final submission
- Final submission carries only Cloudinary public IDs (not raw files)
- One photo designated as primary (`isPrimary: true`)

**Step 4 (final screen) — Submitter Identity**
- Optional: submitter name, submitter email (for notifications)
- Optional: free-text note to admin (context, hours of operation, special notes)
- Review summary before submission

### 3.3 Draft Persistence

Submissions are saved as `DRAFT` immediately when the server processes the final payload. The draft is not visible to the public or in search. It is only visible to admins and (if authenticated) to the submitter.

Draft-to-queue transition is automatic: within the same database transaction, the status advances to `PENDING_REVIEW`. There is no manual "submit" step after payment or confirmation — submission IS the trigger.

### 3.4 Duplicate Prevention

Before saving any draft:
1. Exact name + city match → reject `409` with the existing listing's public slug
2. Fuzzy name match (pg_trgm similarity > 0.75) + same city → allow submission, flag `VerificationRecord` with possible duplicate candidates for admin attention
3. No match → proceed normally

Fuzzy duplicate candidates are recorded in `VerificationRecord.internalNotes`. Admins see a "possible duplicate" warning in the review queue.

### 3.5 Confirmation Notification

On successful submission:
- A confirmation email is sent via Resend to `submitterEmail` (if provided)
- Email includes: restaurant name, submission reference ID (truncated UUID), expected review timeline, next steps, and a unique edit link (HMAC-signed, 7-day TTL) for DRAFT status only
- Email failure is best-effort: submission is NOT rolled back on Resend failure

---

## 4. VERIFICATION WORKFLOW

The verification workflow is the state machine that governs every restaurant's journey through the review process. It is defined in full in verification-system-track.md. This section provides the implementation-level summary and constraints relevant to Track 2.

### 4.1 State Machine Summary

```
DRAFT           → PENDING_REVIEW      Actor: SYSTEM   (automatic on submission)
PENDING_REVIEW  → APPROVED            Actor: ADMIN/SUPER
PENDING_REVIEW  → NEEDS_INFO          Actor: ADMIN/SUPER
PENDING_REVIEW  → REJECTED            Actor: ADMIN/SUPER
NEEDS_INFO      → PENDING_REVIEW      Actor: SYSTEM   (on submitter response)
NEEDS_INFO      → REJECTED            Actor: ADMIN/SUPER (stale, no response)
APPROVED        → NEEDS_INFO          Actor: ADMIN/SUPER (post-approval quality issue)
APPROVED        → REJECTED            Actor: ADMIN/SUPER (mandatory reason required)
REJECTED        → PENDING_REVIEW      Actor: ADMIN/SUPER (appeal/resubmission)
```

All other transitions are forbidden. The state machine rejects them before any database write.

### 4.2 Ownership of State Transitions

`verification.service.ts` is the sole module authorised to change `Restaurant.verificationStatus` or `VerificationRecord.currentStatus`. A Prisma client extension enforces this: any attempt to update `verificationStatus` outside the verification service throws immediately.

### 4.3 Transaction Guarantee

Every state transition executes within a single Prisma transaction:
1. `Restaurant.verificationStatus` updated
2. `VerificationRecord.currentStatus` updated
3. `VerificationEvent` created (immutable log entry)
4. Confidence score recalculated and persisted to both `Restaurant.confidenceScore` and `VerificationRecord.confidenceScore`

If any step fails, all steps roll back. Partial state is never committed.

### 4.4 NEEDS_INFO Response Flow

When an admin transitions a submission to `NEEDS_INFO`:
- A signed JWT response token is generated (`response-token.service.ts`)
- Token payload: `{ restaurantId, verificationRecordId, exp }` — no PII
- Token expires in 14 days
- Token is embedded in the notification email as a unique response URL: `/verify/respond?token=...`
- The used-token hash is stored in `UsedVerificationToken` after the first use
- Second use of the same token returns `410 Gone`

### 4.5 NEEDS_INFO Timeout Policy

Submissions that have been in `NEEDS_INFO` for 30 days with no submitter response are eligible for rejection.

**Phase 1 implementation:** Manual admin action. The admin dashboard shows a "stale items" filter for NEEDS_INFO entries older than 30 days. The admin triggers the rejection manually, which uses the standard `NEEDS_INFO → REJECTED` transition and creates the audit event.

**Phase 2:** This will be automated via a scheduled task. No cron infrastructure is added in Phase 1.

---

## 5. ADMIN REVIEW WORKFLOW

This section describes the operational workflow from the admin's perspective. The Admin Platform track defines the UI; this track defines what each review action must do at the service layer.

### 5.1 Queue Management

The admin review queue surfaces restaurants in `PENDING_REVIEW` status, ordered by `createdAt` ascending (oldest first) by default.

Admins can filter by:
- Status: `PENDING_REVIEW`, `NEEDS_INFO`, `APPROVED`, `REJECTED`
- Assigned to: self, any admin, unassigned
- Duplicate flag: possible duplicates only
- City

**Soft assignment:** When an admin opens a restaurant review screen, `VerificationRecord.assignedTo` is set to their user ID. This is advisory — it shows other admins that someone is actively reviewing. It does not lock the record. Assignment is cleared when a transition is made.

### 5.2 Review Screen Information

The admin review screen presents:
- All restaurant fields from the intake submission
- All submitted dishes (with the submitter's `nameAsServed`, `description`, `price`, `availabilityStatus`)
- All submitted photos (with verification controls — "Mark as Verified" per photo)
- Confidence score breakdown (current score, with per-signal detail)
- Internal notes (only visible to admins)
- Full `VerificationEvent` history for this restaurant
- Possible duplicate warning (if flagged)

### 5.3 Approval Action

The admin reviews all information and clicks Approve.

Service layer actions (in a single transaction):
1. Validate transition: `PENDING_REVIEW → APPROVED` is allowed for this actor
2. Update `Restaurant.verificationStatus` to `APPROVED`
3. Update `VerificationRecord.currentStatus` to `APPROVED`
4. Recalculate and persist confidence score
5. Write `VerificationEvent` (fromStatus, toStatus, actorId, actorRole, ipAddress)
6. Clear `VerificationRecord.assignedTo`
7. Send approval notification email to `submitterEmail` (best-effort)

### 5.4 Needs-Info Action

The admin clicks "Request More Information" and provides a message to the submitter.

`feedbackToSubmitter` is required — cannot trigger NEEDS_INFO without it.

Service layer actions (in a single transaction):
1. Validate transition
2. Update `VerificationRecord.feedbackToSubmitter` with admin's message
3. Update statuses
4. Write `VerificationEvent`
5. Generate response token (via `response-token.service.ts`)
6. Send NEEDS_INFO email with: feedback text, response link (token), deadline (14-day token expiry)

The admin's internal notes and identity are NOT included in the submitter email. Only `feedbackToSubmitter` text is sent.

### 5.5 Rejection Action

The admin clicks Reject and provides a reason.

`reason` is required for all rejections. The Zod schema enforces this — a rejection without a reason returns `422`.

Service layer actions:
1. Validate transition
2. Update `VerificationRecord.internalNotes` with the reason (admin-visible only)
3. Update statuses
4. Write `VerificationEvent` with the reason field populated
5. Send rejection notification email: a sanitised message (not the raw internal notes) explaining the submission was not approved

**Internal notes are never sent to submitters.** The notification email uses a fixed template with the `feedbackToSubmitter` field only.

### 5.6 Post-Approval Corrections

If quality issues are discovered after a restaurant is approved, an admin can move it back to `NEEDS_INFO`.

`APPROVED → NEEDS_INFO` follows the same service flow as §5.4. The restaurant remains visible in search during this period (it retains `APPROVED` status — the transition is recorded but the restaurant's public visibility is not immediately changed). Once back in NEEDS_INFO, the search system continues to show the listing using the last approved data.

**Rationale:** An approved restaurant going dark immediately upon a quality concern would be disruptive to users who rely on that listing. The admin has the tool to remove it (`APPROVED → REJECTED`) if the concern is severe.

---

## 6. DATA COLLECTION WORKFLOW

Intelligence collection is the process by which admins enrich dish-level data during and after verification. This is what transforms a basic "restaurant exists" record into a structured food intelligence asset.

### 6.1 What Intelligence Is Collected

During the admin review of a submission, admins do not only approve or reject — they also enrich:

**Dish-Level Intelligence**
- Confirm each dish is genuinely served at the restaurant
- Set `RestaurantDish.verifiedAt` when confirmed (the timestamp records when a dish was verified, not just that it was verified)
- Correct or confirm `availabilityStatus` (ALWAYS_AVAILABLE / SEASONAL / WEEKEND_ONLY / ON_ORDER / UNKNOWN)
- Confirm or correct `price` in Naira
- Correct the submitter's `nameAsServed` if it differs from common usage

**Photo Intelligence**
- Mark each photo as `isVerified = true` if it is authentic and appropriate
- Flag the primary photo (`isPrimary`)
- Any photo NOT marked verified does not contribute to the confidence score

**Taxonomy Gap Resolution**
- If the submitter named dishes not in the taxonomy, the admin creates the taxonomy entry first (via the admin dish management tool)
- Then links the new taxonomy entry to this restaurant's submission
- This is the primary pathway for growing the DishTaxonomy over time

### 6.2 Intelligence Collection Timing

| Phase | When | Who |
|---|---|---|
| Initial | During first PENDING_REVIEW review | Admin performing the review |
| Post-approval | Ongoing re-verification visits | Any admin |
| Demand-triggered | When a user reports a dish as unavailable (Phase 2) | Admin following up |

Phase 1 supports Initial and Post-approval collection. User-triggered reports are Phase 2.

### 6.3 Intelligence Quality Floor

An approval is not valid unless the following minimum intelligence thresholds are met:

| Requirement | Minimum |
|---|---|
| Verified dishes | At least 1 dish with `verifiedAt` set |
| Confidence score at approval | Must be ≥ 0.40 after the APPROVED signal is included |

If an admin attempts to approve a restaurant that would result in a confidence score below 0.40 at approval time, the service layer returns a `422` error. The admin must either enrich the data further or record why the low score is acceptable via an internal note (SUPER only can override this threshold).

### 6.4 Score Recalculation Triggers

The confidence score is always recalculated from scratch — never incremented. Recalculation is triggered by:

| Trigger | Who |
|---|---|
| Any verification status transition | Verification service (automatic) |
| Admin marks a photo as verified | Intelligence service |
| Admin sets `verifiedAt` on a dish | Intelligence service |
| Admin adds a new dish to a restaurant | Intelligence service |
| Admin removes a dish | Intelligence service |

After recalculation, both `Restaurant.confidenceScore` and `VerificationRecord.confidenceScore` are updated in the same transaction.

### 6.5 Score Breakdown Persistence

The full scoring breakdown (per-signal contributions) is stored in `VerificationRecord.scoreBreakdown` as JSON. This allows admins to see exactly why a restaurant scored what it scored. The breakdown is recalculated and overwritten on each score recalculation.

Structure:
```
scoreBreakdown: {
  phoneVerified: 0.20 | 0,
  verifiedPhotoExists: 0.15 | 0,
  threeOrMoreDishes: 0.15 | 0,
  adminApproved: 0.25 | 0,
  descriptionProvided: 0.10 | 0,
  detailedAddress: 0.10 | 0,
  contactChannelPresent: 0.05 | 0,
  total: 0.000–1.000
}
```

---

## 7. SECURITY MODEL

### 7.1 Authentication Boundaries

| Surface | Auth Requirement |
|---|---|
| `POST /api/v1/intake/restaurants` | None (anonymous submissions accepted) |
| `POST /api/v1/intake/photos` | None |
| `GET /api/v1/intake/dishes` | None |
| `POST /api/v1/verification/respond/:token` | Token-based (signed JWT, no session) |
| All `/api/v1/admin/*` routes | Session required; role `ADMIN` or `SUPER` |
| All `/admin/*` pages | Session required; middleware-checked |

### 7.2 Defense in Depth: All Admin Routes

Every admin API route has two mandatory security checks:

```
Check 1 (Middleware): pathname.startsWith('/admin') → redirect to /login if no valid session
Check 2 (Route Handler): getServerSession() → re-validate role on every request
```

Middleware is a first gate only. The route handler is the authoritative gate. Both must be present.

### 7.3 Response Token Security

The NEEDS_INFO response token is a JWT signed with `NEXTAUTH_SECRET` via the `jose` library.

| Property | Value |
|---|---|
| Algorithm | HS256 (symmetric, server-only secret) |
| Payload | `restaurantId`, `verificationRecordId`, `exp` |
| Expiry | 14 days |
| Replay prevention | SHA-256 hash of token stored in `UsedVerificationToken` table on first use |
| Second use | Returns `410 Gone` |
| Payload PII | None — no email, name, or personal data in token |

### 7.4 Rate Limiting (Track 2 Relevant Limits)

Rate limits are enforced at the route handler using the PostgreSQL `RateLimit` table (not Redis, not middleware). The rate limit check runs before authentication or validation on affected routes.

| Endpoint | Limit |
|---|---|
| `POST /api/v1/intake/restaurants` | 3 per IP per hour |
| `POST /api/v1/intake/photos` | 20 per IP per day |
| `GET /api/v1/intake/dishes` | 60 per IP per minute |
| `POST /api/v1/verification/respond/:token` | 10 per token per hour (prevents brute-force token scanning) |
| Admin endpoints | 200 per session per minute |

### 7.5 File Upload Security Chain

Every photo uploaded through the intake pipeline goes through this chain in order:
1. Check `Content-Length` header ≤ 5MB before reading body
2. Read first 8 bytes; validate magic bytes for JPEG, PNG, or WebP
3. Reject MIME type mismatches (do not trust the `Content-Type` header)
4. Strip EXIF metadata via `sharp` (before upload — GPS coordinates must not be stored)
5. Upload to Cloudinary in the scoped folder (`chowhere/intake/{year}/{month}`)
6. Return only the CDN URL — never store Cloudinary credentials client-side

Admin-uploaded evidence photos use the same chain with a 10MB size limit.

### 7.6 Internal Data Isolation

`VerificationRecord.internalNotes` is admin-only. It is never returned in any public-facing or submitter-facing API response. All API queries that include `VerificationRecord` must explicitly exclude `internalNotes` from the response shape unless the caller has `ADMIN` or `SUPER` role.

### 7.7 Submitter Edit Link Security

The edit link in the confirmation email is HMAC-signed:
- Signed with `NEXTAUTH_SECRET` using SHA-256
- Payload: `{ restaurantId, exp }` — 7-day TTL
- Valid only while the restaurant is in `DRAFT` status
- Link is invalidated the moment status advances to `PENDING_REVIEW`

---

## 8. AUDIT REQUIREMENTS

### 8.1 What Must Be Audited

Every action listed below must produce an immutable `VerificationEvent` record at the time of the action. There are no exceptions.

| Trigger | fromStatus | toStatus | actorId |
|---|---|---|---|
| Intake submission received | `null` | `DRAFT` | `SYSTEM` |
| Submission queued for review | `DRAFT` | `PENDING_REVIEW` | `SYSTEM` |
| Admin approves | `PENDING_REVIEW` | `APPROVED` | admin.id |
| Admin requests info | `PENDING_REVIEW` | `NEEDS_INFO` | admin.id |
| Admin rejects | `PENDING_REVIEW` | `REJECTED` | admin.id |
| Submitter responds | `NEEDS_INFO` | `PENDING_REVIEW` | `SYSTEM` |
| Admin stale-rejects | `NEEDS_INFO` | `REJECTED` | admin.id |
| Admin re-opens post-approval | `APPROVED` | `NEEDS_INFO` | admin.id |
| Admin revokes approval | `APPROVED` | `REJECTED` | admin.id |
| Admin re-opens rejection | `REJECTED` | `PENDING_REVIEW` | admin.id |

### 8.2 VerificationEvent Immutability Guarantee

`VerificationEvent` records are append-only. The Prisma client extension must:
- Reject `update` operations on `VerificationEvent`
- Reject `delete` operations on `VerificationEvent`
- Allow `create` only

Any attempt to modify a `VerificationEvent` after creation is treated as a security violation and logged as an error.

### 8.3 Intelligence Action Audit

The following intelligence collection actions are recorded — not in `VerificationEvent` but in a consistent application log (Vercel logs, structured format):

- Photo verification action: `{ action: 'PHOTO_VERIFIED', photoId, restaurantId, adminId, timestamp }`
- Dish verification action: `{ action: 'DISH_VERIFIED', restaurantDishId, restaurantId, adminId, timestamp }`
- Score recalculation: `{ action: 'SCORE_RECALCULATED', restaurantId, oldScore, newScore, trigger, timestamp }`

These are operational logs, not database records. If intelligence audit trail becomes a regulatory requirement, they will be promoted to database records in a future track.

### 8.4 Admin IP Capture

Every `VerificationEvent` records the admin's IP address at the time of the action (`ipAddress` field). This is captured from the `x-forwarded-for` or `x-real-ip` headers (Vercel infrastructure sets these). The IP is stored as a VARCHAR, not used for rate limiting, and is retained indefinitely as part of the immutable audit record.

### 8.5 Confidence Score Override Audit

Only `SUPER` can override a confidence score manually. A score override writes a special `VerificationEvent` with `action: SCORE_OVERRIDE`, the old score, new score, and a mandatory reason. This event type exists alongside the standard status-transition events.

---

## 9. API BOUNDARIES

This section defines every API endpoint Track 2 owns. All routes are under `/api/v1/`. All responses conform to the standard response envelope (see master-architecture.md §6.2).

### 9.1 Public Intake API

#### POST /api/v1/intake/restaurants
**Purpose:** Submit a restaurant for review  
**Auth:** None (anonymous accepted)  
**Rate limit:** 3 per IP per hour  
**Body:** `IntakeSubmissionSchema` (see restaurant-intake-track.md §3.1)  
**Success:** `201` `{ submissionId, message }`  
**Errors:** `422` (validation), `409` (exact duplicate), `429` (rate limit), `500`

#### POST /api/v1/intake/photos
**Purpose:** Upload a photo; receive Cloudinary public ID for use in final submission  
**Auth:** None  
**Rate limit:** 20 per IP per day  
**Content-Type:** `multipart/form-data`  
**Success:** `200` `{ publicId, width, height, thumbnailUrl }`  
**Errors:** `400` (file validation), `429` (rate limit), `500`

#### GET /api/v1/intake/dishes
**Purpose:** Search DishTaxonomy for the Step 2 dish selector  
**Auth:** None  
**Rate limit:** 60 per IP per minute  
**Query:** `?q=jollof&limit=20`  
**Success:** `200` `{ dishes: [{ id, canonicalName, aliases, category }] }`

### 9.2 Submitter Response API

#### POST /api/v1/verification/respond/:token
**Purpose:** Submitter responds to a NEEDS_INFO request  
**Auth:** Token-based (signed JWT, no session)  
**Rate limit:** 10 per token per hour  
**Body:** `{ responseText: string, additionalPhotoIds?: string[] }`  
**Success:** `200` `{ message: "Response received. Your submission has re-entered the review queue." }`  
**Errors:** `400` (invalid/expired token), `410` (token already used), `422` (validation), `429` (rate limit)

**Token validation sequence:**
1. Verify JWT signature with `NEXTAUTH_SECRET`
2. Check token expiry (`exp` claim)
3. Hash token; check against `UsedVerificationToken` table
4. Confirm `restaurantId` from token is in `NEEDS_INFO` status
5. Execute `NEEDS_INFO → PENDING_REVIEW` transition
6. Store token hash in `UsedVerificationToken`

### 9.3 Admin Verification API

All admin endpoints require session with `ADMIN` or `SUPER` role. Role check is in the route handler, not only middleware.

#### GET /api/v1/admin/verification/queue
**Purpose:** Paginated list of submissions for admin review  
**Auth:** ADMIN or SUPER  
**Query:** `?status=PENDING_REVIEW&page=1&limit=20&sortBy=createdAt&assignedTo=me&city=Lagos`  
**Success:** `200` `{ restaurants: [...], meta: { total, page, limit } }`  
**Note:** `internalNotes` is included in admin responses. Score breakdown is included.

#### GET /api/v1/admin/verification/:restaurantId
**Purpose:** Full restaurant detail for admin review screen  
**Auth:** ADMIN or SUPER  
**Action:** Sets `VerificationRecord.assignedTo` to requesting admin's ID (soft assignment)  
**Success:** `200` Full restaurant with all relations, verification record, event history

#### POST /api/v1/admin/verification/:restaurantId/approve
**Purpose:** Approve the submission  
**Auth:** ADMIN or SUPER  
**Body:** `{ notes?: string }` (optional internal note)  
**Action:** Validates minimum intelligence thresholds → state transition → score recalculation → notification  
**Success:** `200` `{ restaurant: { id, verificationStatus, confidenceScore } }`  
**Errors:** `422` (transition invalid, or score below 0.40 threshold), `404`, `403`

#### POST /api/v1/admin/verification/:restaurantId/reject
**Purpose:** Reject the submission  
**Auth:** ADMIN or SUPER  
**Body:** `{ reason: string }` (required)  
**Action:** State transition → audit event → notification email  
**Success:** `200`  
**Errors:** `422` (missing reason), `404`, `403`

#### POST /api/v1/admin/verification/:restaurantId/needs-info
**Purpose:** Request more information from the submitter  
**Auth:** ADMIN or SUPER  
**Body:** `{ feedbackToSubmitter: string }` (required)  
**Action:** State transition → generate response token → notification email with response link  
**Success:** `200`  
**Errors:** `422` (missing feedback), `404`, `403`

#### GET /api/v1/admin/verification/:restaurantId/history
**Purpose:** Full `VerificationEvent` audit log for a restaurant  
**Auth:** ADMIN or SUPER  
**Success:** `200` `{ events: [VerificationEvent] }` ordered by `createdAt` ascending

### 9.4 Admin Intelligence API

#### PATCH /api/v1/admin/restaurants/:restaurantId/dishes/:dishId/verify
**Purpose:** Mark a RestaurantDish as admin-verified  
**Auth:** ADMIN or SUPER  
**Body:** `{ verifiedAt: ISO datetime, availabilityStatus?, price?, nameAsServed? }`  
**Action:** Update `RestaurantDish.verifiedAt`; recalculate confidence score  
**Success:** `200` `{ dish: { id, verifiedAt, availabilityStatus } }`

#### PATCH /api/v1/admin/restaurants/:restaurantId/photos/:photoId/verify
**Purpose:** Mark a RestaurantPhoto as admin-verified  
**Auth:** ADMIN or SUPER  
**Body:** `{ isVerified: boolean, isPrimary?: boolean }`  
**Action:** Update photo; recalculate confidence score if `isVerified` changes  
**Success:** `200` `{ photo: { id, isVerified, isPrimary } }`

#### PATCH /api/v1/admin/restaurants/:restaurantId/intelligence
**Purpose:** Admin enrichment of restaurant-level intelligence fields  
**Auth:** ADMIN or SUPER  
**Body:** Partial update of: `description`, `phone`, `email`, `website`, `priceRange`, `area`  
**Action:** Update restaurant fields; recalculate confidence score  
**Success:** `200` `{ restaurant: { id, confidenceScore } }`  
**Note:** `name`, `slug`, `city`, `state`, and `verificationStatus` cannot be changed via this endpoint.

#### POST /api/v1/admin/verification/:restaurantId/score/override
**Purpose:** SUPER-only manual confidence score override  
**Auth:** SUPER only  
**Body:** `{ score: number, reason: string }` (both required)  
**Action:** Set score; write override audit event  
**Success:** `200`  
**Errors:** `403` (non-SUPER), `422` (score out of 0–1 range, missing reason)

---

## 10. UI BOUNDARIES

### 10.1 Public UI Surfaces

#### `/submit` — Restaurant Intake Form
- Multi-step wizard (Steps 1–4)
- Client-side Zod validation on each step before advancing
- Photo upload with progress indicator; Cloudinary public ID stored in form state
- Dish typeahead search hitting `GET /api/v1/intake/dishes`
- Final submission via TanStack Query mutation
- Success screen with confirmation reference

**Rendering strategy:** Client Component (`'use client'`) — form is interactive.  
**No SSR required.** The submit page has no SEO value.

#### `/verify/respond` — Submitter Response Form
- Displays the original feedback text from the admin
- Text area for submitter's response
- Optional additional photo upload (same pipeline as intake)
- Single submission to `POST /api/v1/verification/respond/:token`
- Success/error states (expired token, already used)

**Rendering strategy:** Client Component.  
**Token is read from query string on page load.**

### 10.2 Admin UI Surfaces

All admin UI is under `/admin/*`. These are Client Components (auth-gated, no SEO value).

#### `/admin/queue` — Verification Queue
- Paginated table of submissions in PENDING_REVIEW (default) and NEEDS_INFO
- Filter bar: status, city, assigned-to, duplicate flag, date range
- Each row links to the review screen
- "Stale items" filter surfaces NEEDS_INFO entries older than 30 days
- Queue depth metrics: total pending, total needs-info, average age

**Data source:** `GET /api/v1/admin/verification/queue`

#### `/admin/restaurants/:id/review` — Admin Review Screen
- Full restaurant detail display (all intake fields)
- Dish list with per-dish verify controls (availability, price, verify button)
- Photo grid with verify/primary controls
- Confidence score widget (current score + breakdown by signal)
- Internal notes (admin-only text area, visible only to admins)
- Feedback to submitter field (required for NEEDS_INFO, shown when selecting that action)
- Action panel: Approve / Request Info / Reject (with confirmation dialogs)
- Possible duplicate warning (if flagged)
- Full event history timeline

**Data source:** `GET /api/v1/admin/verification/:restaurantId`  
**Assignment:** Soft-assigned when screen opens (automatic)

#### `/admin/restaurants/:id/intelligence` — Intelligence Edit Screen
- Separate screen for ongoing post-approval enrichment
- Dish verification and editing
- Photo management
- Restaurant-level field corrections (description, contact, price range)
- Score breakdown panel

This screen is distinct from the review screen to signal the intent: review is a one-time gatekeeping action; intelligence editing is ongoing maintenance.

### 10.3 Shared UI Components (Track 2 Specific)

| Component | Location | Used By |
|---|---|---|
| `VerificationStatusBadge` | `features/verification/components/` | Queue, review screen |
| `ConfidenceScoreWidget` | `features/verification/components/` | Review screen, intelligence screen |
| `DishVerifyCard` | `features/verification/components/` | Review screen, intelligence screen |
| `PhotoVerifyGrid` | `features/verification/components/` | Review screen, intelligence screen |
| `VerificationEventTimeline` | `features/verification/components/` | Review screen |
| `IntakeFormContainer` | `features/restaurants/components/IntakeForm/` | `/submit` |
| `DishTypeahead` | `features/restaurants/components/` | Step 2 of intake form |

These are feature-scoped components. They are not placed in `components/ui/` or `components/layout/`.

---

## 11. DATABASE INTERACTIONS

The schema is complete and migrated (database-track.md). Track 2 does not introduce new schema. This section defines which tables are read and written by each system in this track, and the ownership rules.

### 11.1 Table Ownership Map

| Table | Track 2 System | Access Type |
|---|---|---|
| `Restaurant` | Intake Service | Create (DRAFT), Read |
| `Restaurant` | Verification Service | Update (`verificationStatus`, `confidenceScore`) |
| `Restaurant` | Intelligence Service | Update (description, phone, area, priceRange) |
| `RestaurantDish` | Intake Service | Create |
| `RestaurantDish` | Intelligence Service | Update (`verifiedAt`, `availabilityStatus`, `price`, `nameAsServed`) |
| `RestaurantPhoto` | Intake Service | Create (via photo upload) |
| `RestaurantPhoto` | Intelligence Service | Update (`isVerified`, `isPrimary`) |
| `VerificationRecord` | Intake Service | Create |
| `VerificationRecord` | Verification Service | Update (`currentStatus`, `confidenceScore`, `scoreBreakdown`, `assignedTo`, `feedbackToSubmitter`, `internalNotes`) |
| `VerificationEvent` | Verification Service | Create only (append-only) |
| `UsedVerificationToken` | Response Token Service | Create (on token use), Read (replay check) |
| `DishTaxonomy` | Intake Service | Read only (dish lookup) |
| `DishTaxonomy` | Admin Intelligence | Create, Update (taxonomy gap resolution) |
| `RateLimit` | Route handlers | Create, Update, Read |
| `User` | Auth helpers | Read (session validation) |

### 11.2 Query Patterns

**Admin queue query** — paginated, filtered:
```
WHERE currentStatus = ? AND (assignedTo = ? OR assignedTo IS NULL)
ORDER BY createdAt ASC
LIMIT 20 OFFSET ?
```
Index used: `VerificationRecord.currentStatus`, `VerificationRecord.assignedTo`

**Duplicate check — exact:**
```
WHERE LOWER(name) = LOWER(?) AND city = ? AND deletedAt IS NULL
```
Index used: `Restaurant.city` (partial; exact match is fast)

**Duplicate check — fuzzy:**
Raw SQL using `pg_trgm` similarity function. Must use `Prisma.sql` template, never string interpolation.

**Confidence score triggers** — the score recalculation query fetches:
```
Restaurant (with phone, description, address, website, email, verificationStatus)
  + RestaurantDish (count of non-deleted records)
  + RestaurantPhoto (count where isVerified = true)
```
This is a single query with `include`. No N+1 queries.

### 11.3 Transaction Patterns

All state transitions use `db.$transaction([...])` with all writes in a single transaction. The transaction includes:
1. `restaurant.update` (verificationStatus, confidenceScore)
2. `verificationRecord.update` (currentStatus, confidenceScore, scoreBreakdown, any other fields)
3. `verificationEvent.create` (the audit record)

Confidence score recalculation (when triggered outside of a state transition, e.g., photo verification):
1. `restaurantPhoto.update` or `restaurantDish.update` (the intelligence change)
2. `restaurant.update` (new confidenceScore)
3. `verificationRecord.update` (new confidenceScore, new scoreBreakdown)

All three in a single transaction.

### 11.4 Soft Delete Enforcement

All queries against `Restaurant` and `RestaurantDish` must include `where: { deletedAt: null }`. A Prisma middleware extension enforces this globally. Never query deleted records in normal operations.

---

## 12. INCREMENTAL IMPLEMENTATION SEQUENCE

All steps follow the engineering law: **Schema → Service → API → UI**. Since the schema is complete and migrated, Track 2 begins at the service layer.

Steps must be completed in order. No step begins until the previous step's tests pass.

---

### Step 1 — Verification State Machine
**Deliverable:** `features/verification/services/state-machine.ts`

Actions:
1. Define `ALLOWED_TRANSITIONS` constant (all transitions, all actors)
2. Write `validateTransition(from, to, actorRole): TransitionResult` pure function
3. Write comprehensive unit tests — every valid transition, every forbidden transition, every role combination

Exit criteria: 100% of state machine unit tests pass. No transition is missing from the test suite.

---

### Step 2 — Confidence Scoring Service
**Deliverable:** `features/verification/services/confidence-score.service.ts`

Actions:
1. Write `calculateConfidenceScore(restaurant: RestaurantWithRelations): number`
2. Write `getScoreBreakdown(restaurant): ScoreBreakdown`
3. Write unit tests with fixture restaurants covering every combination of signals
4. Verify that score at APPROVED with all signals = 1.000

Exit criteria: All signal weights sum to 1.000. All fixture tests pass.

---

### Step 3 — Response Token Service
**Deliverable:** `features/verification/services/response-token.service.ts`

Actions:
1. Write `generateResponseToken(restaurantId, verificationRecordId): string` using `jose`
2. Write `validateResponseToken(token): TokenPayload | null`
3. Write `markTokenUsed(token): void` — stores hash in `UsedVerificationToken`
4. Write `isTokenUsed(token): boolean` — checks hash table
5. Write unit tests for: valid token, expired token, used token, tampered token

Exit criteria: Replay prevention works. Tampered tokens are rejected.

---

### Step 4 — Notification Service
**Deliverable:** `features/verification/services/notification.service.ts` + email templates

Actions:
1. Create React Email templates:
   - `IntakeConfirmationEmail.tsx` — submission received
   - `NeedsInfoEmail.tsx` — admin feedback + response link
   - `ApprovalEmail.tsx` — submission approved
   - `RejectionEmail.tsx` — submission rejected (sanitised reason)
2. Write `notification.service.ts` — dispatches the correct template via Resend
3. All sends are best-effort: failures are logged but do not throw
4. Verify Resend integration in development with test API key

Exit criteria: All four email types render correctly. Resend calls succeed in development.

---

### Step 5 — Intake Service
**Deliverable:** `features/restaurants/services/intake.service.ts` + supporting services

Actions:
1. Write `slug.service.ts` — generate URL-safe unique slug from restaurant name
2. Write `duplicate-check.service.ts` — exact and fuzzy duplicate detection
3. Write `intake.service.ts` — orchestrates: validate → duplicate check → create Restaurant (DRAFT) → create RestaurantDish records → create VerificationRecord → create VerificationEvent → send confirmation email
4. Write unit tests for slug generation edge cases (duplicates, special characters)
5. Write integration tests for intake service (real DB against test schema)

Exit criteria: End-to-end intake creates all records in a single transaction. Duplicate detection works for exact and fuzzy cases.

---

### Step 6 — Verification Orchestrator Service
**Deliverable:** `features/verification/services/verification.service.ts`

Actions:
1. Write `approve(restaurantId, actorId, actorRole, notes?, ipAddress)` — calls state machine → transaction → score recalculation → notification
2. Write `reject(restaurantId, actorId, actorRole, reason, ipAddress)`
3. Write `requestInfo(restaurantId, actorId, actorRole, feedbackToSubmitter, ipAddress)` — calls token service → notification
4. Write `processSubmitterResponse(token, responseText, additionalPhotoIds?, ipAddress)` — validates token → transition → notification
5. Write `assignAdmin(restaurantId, adminId)` — soft assignment (not transactional)
6. Write integration tests for each transition type

Exit criteria: Every transition creates a `VerificationEvent`. Every transition updates both `Restaurant` and `VerificationRecord` atomically. All tests pass.

---

### Step 7 — Intelligence Service
**Deliverable:** `features/verification/services/intelligence.service.ts`

Actions:
1. Write `verifyDish(restaurantDishId, adminId, updates)` — updates dish + triggers score recalculation
2. Write `verifyPhoto(photoId, adminId, isVerified, isPrimary)` — updates photo + triggers score recalculation
3. Write `updateRestaurantIntelligence(restaurantId, adminId, fields)` — restricted field updates + triggers score recalculation
4. Write integration tests for score recalculation on each trigger

Exit criteria: Score recalculates correctly after each intelligence action. Forbidden fields (verificationStatus, name, slug) cannot be changed via this service.

---

### Step 8 — Photo Upload API
**Deliverable:** `app/api/v1/intake/photos/route.ts`

Actions:
1. Implement file validation chain (Content-Length, magic bytes, EXIF strip via `sharp`)
2. Implement Cloudinary upload via `lib/cloudinary.ts`
3. Return `publicId`, `width`, `height`, `thumbnailUrl`
4. Implement rate limiting (20 per IP per day)
5. Write integration tests

Exit criteria: JPEG and PNG uploads succeed. Files with wrong magic bytes are rejected with 400. Files over 5MB are rejected before reading the body.

---

### Step 9 — Intake Submission API
**Deliverable:** `app/api/v1/intake/restaurants/route.ts`

Actions:
1. Implement `IntakeSubmissionSchema` validation
2. Wire rate limit check (3 per IP per hour)
3. Call `intake.service.ts`
4. Return `201` with `submissionId`
5. Write integration tests for validation errors, duplicate rejection, rate limit

Exit criteria: Valid submission creates all records and sends confirmation. Exact duplicate returns 409. Rate limit returns 429.

---

### Step 10 — Dish Search API
**Deliverable:** `app/api/v1/intake/dishes/route.ts`

Actions:
1. Implement dish typeahead query (FTS + pg_trgm on `DishTaxonomy`)
2. Return only active dishes (`isActive = true`)
3. Limit to 20 results
4. Minimum query length: 2 characters

Exit criteria: Dish search returns relevant matches. Inactive dishes do not appear.

---

### Step 11 — Admin Verification Queue API
**Deliverable:** `app/api/v1/admin/verification/queue/route.ts`

Actions:
1. Implement authentication and role check
2. Implement paginated, filtered query
3. Include confidence score and breakdown in response
4. Write tests for pagination, filter combinations

Exit criteria: Queue returns correctly filtered and paginated results. `internalNotes` is included. Unauthenticated requests return 401.

---

### Step 12 — Admin Verification Action APIs
**Deliverables:**
- `app/api/v1/admin/verification/[restaurantId]/approve/route.ts`
- `app/api/v1/admin/verification/[restaurantId]/reject/route.ts`
- `app/api/v1/admin/verification/[restaurantId]/needs-info/route.ts`
- `app/api/v1/admin/verification/[restaurantId]/history/route.ts`
- `app/api/v1/admin/verification/[restaurantId]/route.ts` (GET — detail with soft assignment)

Actions:
1. Implement all five endpoints with auth, role, and input validation
2. Wire to `verification.service.ts`
3. Write integration tests for each action type

Exit criteria: All transitions execute correctly via API. Invalid transitions return 422. Missing reason on reject returns 422.

---

### Step 13 — Submitter Response API
**Deliverable:** `app/api/v1/verification/respond/[token]/route.ts`

Actions:
1. Extract token from path parameter
2. Call `response-token.service.ts` for validation
3. Call `verification.service.ts` for `NEEDS_INFO → PENDING_REVIEW` transition
4. Handle expired token (400), used token (410), invalid token (400)

Exit criteria: Valid token response transitions correctly. Replay attempt returns 410. Expired token returns 400.

---

### Step 14 — Admin Intelligence APIs
**Deliverables:**
- `app/api/v1/admin/restaurants/[restaurantId]/dishes/[dishId]/verify/route.ts`
- `app/api/v1/admin/restaurants/[restaurantId]/photos/[photoId]/verify/route.ts`
- `app/api/v1/admin/restaurants/[restaurantId]/intelligence/route.ts`
- `app/api/v1/admin/verification/[restaurantId]/score/override/route.ts` (SUPER only)

Actions:
1. Implement all four endpoints with auth, role, validation
2. Wire to `intelligence.service.ts`
3. Write integration tests

Exit criteria: Dish and photo verification trigger score recalculation. Field updates are restricted to allowed fields. Score override is SUPER-only.

---

### Step 15 — Public UI: Intake Form
**Deliverable:** `app/(public)/submit/page.tsx` + `features/restaurants/components/IntakeForm/`

Actions:
1. Build `IntakeFormContainer` — multi-step state machine using React Hook Form
2. Build `Step1RestaurantInfo.tsx`
3. Build `Step2DishSelection.tsx` with `DishTypeahead` component
4. Build `Step3Photos.tsx` with per-photo upload and progress
5. Build `Step4SubmitterInfo.tsx` (optional submitter details + review)
6. Build `IntakeConfirmation.tsx` — success screen with reference number
7. Wire to API with TanStack Query mutations

Exit criteria: Full form submits successfully. Client validation catches errors before API calls. Photo upload works independently. All error states have user-facing messages.

---

### Step 16 — Public UI: Submitter Response Form
**Deliverable:** `app/(public)/verify/respond/page.tsx`

Actions:
1. Read token from URL query parameter
2. Display admin's feedback text
3. Text area for submitter's response
4. Optional additional photo upload
5. Submit to `POST /api/v1/verification/respond/:token`
6. Handle expired, used, invalid token states

Exit criteria: Valid token renders correctly. Expired token shows a clear message (not a generic error).

---

### Step 17 — Admin UI: Verification Queue
**Deliverable:** `app/admin/queue/page.tsx`

Actions:
1. Build paginated queue table
2. Build filter bar (status, city, assigned-to, duplicate flag)
3. Build stale items indicator (NEEDS_INFO > 30 days)
4. Link each row to `/admin/restaurants/:id/review`

Exit criteria: Queue loads and paginates. Filters work. Stale items surface correctly.

---

### Step 18 — Admin UI: Review Screen
**Deliverable:** `app/admin/restaurants/[id]/review/page.tsx`

Actions:
1. Build full restaurant detail view
2. Build dish list with per-dish verify controls
3. Build photo grid with verify/primary controls
4. Build `ConfidenceScoreWidget` with breakdown
5. Build action panel (Approve / Request Info / Reject) with confirmation dialogs
6. Build `VerificationEventTimeline`
7. Build possible-duplicate warning panel

Exit criteria: All admin actions trigger correctly. Score updates in real time after dish/photo verification.

---

### Step 19 — Admin UI: Intelligence Screen
**Deliverable:** `app/admin/restaurants/[id]/intelligence/page.tsx`

Actions:
1. Build intelligence edit form (restaurant-level fields)
2. Reuse `DishVerifyCard` and `PhotoVerifyGrid` components from review screen
3. Score breakdown panel
4. Link from restaurant detail view

Exit criteria: Intelligence edits save and trigger score recalculation.

---

## 13. RISKS AND EDGE CASES

### 13.1 Concurrency and Race Conditions

| Risk | Scenario | Mitigation |
|---|---|---|
| Two admins approve simultaneously | Both read `PENDING_REVIEW`, both try to write `APPROVED` | Prisma transaction with implicit row-level lock; second writer succeeds (idempotent — already APPROVED). First writer's event is in history. Acceptable for Phase 1 scale. |
| Score recalculates while transition is in progress | Dish verified during a parallel approval | Both updates are separate transactions; the last writer's score is the authoritative value. The score recalculation after approval will see the verified dish. Acceptable. |
| Token generated but email not delivered | Submitter never receives the response link | Admin can view the token URL from the `VerificationRecord` detail screen (admin-only field) and share it via another channel |
| Submitter responds while admin transitions to REJECTED | Token used but status is already REJECTED | Service checks that restaurant is in `NEEDS_INFO` before accepting response; returns 409 with a clear message |

### 13.2 Data Quality Risks

| Risk | Scenario | Mitigation |
|---|---|---|
| Admin approves without verifying any dishes | Confidence score requirement of ≥ 0.40 at approval time is bypassed | Service enforces minimum score threshold before allowing approval; returns 422 if threshold not met |
| Submitter provides fake photo (screenshotted from internet) | Photo passes technical checks but is inauthentic | Cloudinary auto-moderation handles obvious cases; admin photo verification step flags authenticity concerns; admin marks photo as unverified |
| Submitter uses invalid dish IDs | Crafted request with non-existent dishIds | Server validates all `dishId` values against `DishTaxonomy` table before saving; invalid IDs cause 422 for the entire submission |
| Duplicate restaurant submitted under a different name variant | Fuzzy match threshold is 0.75 — a sufficiently different name variant escapes detection | Possible duplicate flagging is advisory, not blocking; admin sees potential candidates and decides. Over time, the threshold can be tuned. |
| Score drift between `Restaurant.confidenceScore` and `VerificationRecord.confidenceScore` | Both must be identical | Both updated in same transaction; if transaction fails, both roll back. Integrity monitor checks for divergence daily. |

### 13.3 Integration Risks

| Risk | Scenario | Mitigation |
|---|---|---|
| Resend API is down | Notification emails not sent | All email sends are best-effort; submissions and transitions are not rolled back on email failure. Failures are logged as errors. |
| Cloudinary is down | Photo upload fails during intake | Photo upload returns 500 with clear error; form handles this state and allows retry. Submission cannot complete without uploading intended photos. |
| `NEXTAUTH_SECRET` rotation | Existing response tokens become invalid after secret rotation | Response tokens are short-lived (14 days). During a secret rotation, admins should be aware that outstanding NEEDS_INFO tokens will need to be re-issued. Documented in ops runbook. |

### 13.4 Business Logic Edge Cases

| Edge Case | Handling |
|---|---|
| Restaurant submitted with dishes not in taxonomy | Submission accepted; admin creates taxonomy entries during review. `submitterNote` captures dish name suggestions. |
| Submitter provides `submitterEmail` but it bounces | Submission proceeds; notifications are best-effort. Resend bounce events are logged but not acted on in Phase 1. |
| Admin rejects a restaurant that was previously APPROVED | `APPROVED → REJECTED` is a valid transition with mandatory reason. `VerificationEvent` is written. Restaurant immediately becomes invisible to search (status no longer APPROVED). |
| Anonymous submitter wants to check their submission status | They cannot — they have no account. The confirmation email is their only notification channel. If they provided an email, all notifications go there. |
| Restaurant with slug collision at approval time | Slug is generated at submission (DRAFT) time. If a collision is detected later, a numeric suffix is appended. Slug is immutable after first APPROVED state. |

---

## 14. SUCCESS METRICS

Track 2 is complete when all of the following are satisfied.

### 14.1 Functional Completeness

| Criterion | Pass Condition |
|---|---|
| All state machine transitions operational | Every transition in §4.1 works end-to-end via API |
| Intake form functional | Anonymous submission creates all records and sends confirmation email |
| Admin queue functional | PENDING_REVIEW submissions appear in queue |
| Approval flow functional | Approval transitions restaurant to APPROVED and calculates score |
| NEEDS_INFO flow functional | Admin feedback sent; submitter response re-queues |
| Rejection flow functional | Rejection with mandatory reason; submitter notified |
| Photo upload functional | Photos uploaded, EXIF stripped, Cloudinary ID returned |
| Dish typeahead functional | DishTaxonomy search returns relevant results |
| Response token functional | Token-based response works; replay returns 410 |
| Intelligence collection functional | Dish and photo verification update score |

### 14.2 Data Integrity

| Check | Expected Result |
|---|---|
| Every APPROVED restaurant has a VerificationRecord | 100% |
| Every status transition has a corresponding VerificationEvent | 100% |
| `Restaurant.confidenceScore` matches `VerificationRecord.confidenceScore` | 100% (integrity monitor passes) |
| No restaurant in APPROVED status with confidenceScore below 0.40 | 0 violations |
| No VerificationEvent records have been updated or deleted | Confirmed via append-only Prisma extension |

### 14.3 Security

| Check | Expected Result |
|---|---|
| Unauthenticated access to admin APIs returns 401 | 100% |
| USER-role access to admin APIs returns 403 | 100% |
| ADMIN-role access to SUPER-only endpoints returns 403 | 100% |
| Response token replay returns 410 | 100% |
| Expired response token returns 400 | 100% |
| EXIF data absent from all stored photos | Verified on sample set |
| `internalNotes` absent from all non-admin API responses | Confirmed via response audits |

### 14.4 Email Notifications

| Notification | Deliverable |
|---|---|
| Submission confirmation | Sends on successful intake |
| NEEDS_INFO email | Sends with response link on admin action |
| Approval email | Sends when status moves to APPROVED |
| Rejection email | Sends with sanitised reason |

### 14.5 Performance Baselines

These are minimum acceptable levels, not targets. If any are missed, diagnose before considering Track 3 complete.

| Metric | Baseline |
|---|---|
| Admin queue page load (cold) | < 800ms |
| Intake form submission (p95) | < 2s |
| Photo upload (5MB file, p95) | < 4s |
| Verification action (approve/reject/needs-info, p95) | < 500ms |
| Dish typeahead response (p95) | < 200ms |

---

## Appendix A — Module Structure (Track 2 Complete)

```
features/
├── restaurants/
│   ├── components/
│   │   ├── IntakeForm/
│   │   │   ├── IntakeFormContainer.tsx
│   │   │   ├── Step1RestaurantInfo.tsx
│   │   │   ├── Step2DishSelection.tsx
│   │   │   ├── Step3Photos.tsx
│   │   │   └── Step4SubmitterInfo.tsx
│   │   ├── DishTypeahead.tsx
│   │   └── IntakeConfirmation.tsx
│   ├── schemas/
│   │   ├── intake.schema.ts
│   │   └── restaurant.schema.ts
│   ├── services/
│   │   ├── intake.service.ts
│   │   ├── duplicate-check.service.ts
│   │   └── slug.service.ts
│   ├── hooks/
│   │   └── useIntakeForm.ts
│   └── types/
│       └── intake.types.ts
│
└── verification/
    ├── components/
    │   ├── VerificationStatusBadge.tsx
    │   ├── ConfidenceScoreWidget.tsx
    │   ├── DishVerifyCard.tsx
    │   ├── PhotoVerifyGrid.tsx
    │   └── VerificationEventTimeline.tsx
    ├── schemas/
    │   ├── transition.schema.ts
    │   └── response.schema.ts
    ├── services/
    │   ├── verification.service.ts      ← Orchestrator
    │   ├── state-machine.ts
    │   ├── confidence-score.service.ts
    │   ├── response-token.service.ts
    │   ├── intelligence.service.ts
    │   └── notification.service.ts
    ├── emails/
    │   ├── IntakeConfirmationEmail.tsx
    │   ├── NeedsInfoEmail.tsx
    │   ├── ApprovalEmail.tsx
    │   └── RejectionEmail.tsx
    └── types/
        └── verification.types.ts
```

---

## Appendix B — Environment Variables Required by Track 2

All values are server-side only. None carry the `NEXT_PUBLIC_` prefix.

| Variable | Used By |
|---|---|
| `DATABASE_URL` | Prisma (PgBouncer pooled connection) |
| `DIRECT_URL` | Prisma migrations only |
| `NEXTAUTH_SECRET` | Response token signing; session validation |
| `CLOUDINARY_CLOUD_NAME` | Photo upload |
| `CLOUDINARY_API_KEY` | Photo upload |
| `CLOUDINARY_API_SECRET` | Photo upload |
| `RESEND_API_KEY` | Email notifications |
| `NEXT_PUBLIC_APP_URL` | Response link generation in emails |

---

*This document is the governing implementation blueprint for Track 2. Any conflict between this document and a standards document (master-architecture.md, backend-standards.md, security-standards.md, data-governance.md) is resolved in favour of the standards document.*

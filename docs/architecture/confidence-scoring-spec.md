# Chow Here — Confidence Scoring Specification

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-31  
**Parent Documents:** master-architecture.md · verification-system-track.md · track-02-verification-intelligence.md  
**Implementation Target:** `features/verification/services/confidence-score.service.ts`

---

## 0. PURPOSE

This document is the authoritative specification for the Chow Here confidence scoring system. It defines the score range, signal inputs, weights, calculation procedure, threshold enforcement, recalculation triggers, override rules, and audit requirements.

`confidence-score.service.ts` must implement exactly this specification. Any deviation from these rules is a defect.

---

## 1. CONFIDENCE SCORE RANGE

### 1.1 Definition

The confidence score is a bounded decimal value representing the reliability and completeness of a restaurant's listing data.

| Property | Value |
|---|---|
| Minimum | 0.000 |
| Maximum | 1.000 |
| Precision | 3 decimal places |
| Database type | `Decimal(4, 3)` — exactly 1 digit before decimal, 3 after |
| Rounding rule | Round to 3 decimal places using standard rounding (`.toFixed(3)`) |

A score of `0.000` means: no trust signals have been met, or the restaurant has been rejected.  
A score of `1.000` means: every defined trust signal has been met.

No score below `0.000` or above `1.000` is valid. The service must clamp to this range if floating-point arithmetic produces values outside it (this is a defensive rule — correct arithmetic will not exceed the range).

### 1.2 Score Interpretation Bands

These bands are for admin display only. They do not gate any automated behaviour.

| Band | Range | Label | Meaning |
|---|---|---|---|
| Very Low | 0.000 – 0.249 | Incomplete | Critical data gaps present |
| Low | 0.250 – 0.499 | Marginal | Minimal viable data only |
| Medium | 0.500 – 0.699 | Acceptable | Good coverage, room for improvement |
| High | 0.700 – 0.899 | Strong | Most trust signals met |
| Very High | 0.900 – 1.000 | Excellent | Near-complete coverage |

### 1.3 Score by Verification Status

The score reflects the restaurant's current state. The APPROVED signal (see §3) contributes 0.250 only when `verificationStatus = APPROVED`. As the status changes, the score changes accordingly.

| Status | Maximum Possible Score | Notes |
|---|---|---|
| `DRAFT` | 0.750 | APPROVED signal not earned |
| `PENDING_REVIEW` | 0.750 | APPROVED signal not earned |
| `NEEDS_INFO` | 0.750 | APPROVED signal not earned |
| `APPROVED` | 1.000 | APPROVED signal earned |
| `REJECTED` | 0.000 | Score hard-set to zero on rejection |

**REJECTED restaurants always have a score of exactly `0.000`.** This is enforced by the transition handler, not the calculator. The score breakdown immediately before rejection is preserved in `VerificationRecord.scoreBreakdown` for historical reference before being overwritten with zeroed values.

---

## 2. SCORE INPUTS

The score is computed from observable facts about a restaurant record. Each fact is evaluated as a binary condition: the signal is either fully earned or not earned at all. There is no partial credit within a single signal.

### 2.1 Signal Input Definitions

Seven signals feed the score. Each signal is defined precisely below.

---

**Signal 1 — Valid Phone Number**

| Property | Value |
|---|---|
| Signal ID | `S1` |
| Weight | 0.20 |
| Field | `Restaurant.phone` |
| Condition | `phone` is non-null AND passes the Nigerian phone validation regex |
| Validation regex | `/^(\+?234\|0)[789][01]\d{8}$/` |
| Notes | The phone stored in the database has already passed intake validation. This signal re-validates it at score calculation time. A manually edited phone that no longer passes the regex loses this signal on the next recalculation. |

---

**Signal 2 — At Least One Verified Photo**

| Property | Value |
|---|---|
| Signal ID | `S2` |
| Weight | 0.15 |
| Field | `RestaurantPhoto.isVerified` |
| Condition | At least one `RestaurantPhoto` record for this restaurant exists where `isVerified = true` |
| Notes | Photos uploaded by submitters are not verified by default (`isVerified = false`). An admin must explicitly verify each photo. The signal requires exactly one verified photo — additional verified photos do not add further score. |

---

**Signal 3 — Three or More Active Dishes**

| Property | Value |
|---|---|
| Signal ID | `S3` |
| Weight | 0.15 |
| Field | `RestaurantDish.deletedAt` |
| Condition | Count of `RestaurantDish` records for this restaurant where `deletedAt IS NULL` ≥ 3 |
| Notes | Soft-deleted dishes do not count. This signal counts linked dishes, not verified dishes — `verifiedAt` is not part of this condition. Dish verification status affects search quality but not this count signal. |

---

**Signal 4 — Admin Verification (APPROVED Status)**

| Property | Value |
|---|---|
| Signal ID | `S4` |
| Weight | 0.25 |
| Field | `Restaurant.verificationStatus` |
| Condition | `verificationStatus = APPROVED` |
| Notes | This is the heaviest signal because it represents deliberate human judgement. It is automatically earned when a restaurant enters `APPROVED` status and automatically lost when the status changes to anything else. It cannot be earned by any other means. |

---

**Signal 5 — Description of Sufficient Length**

| Property | Value |
|---|---|
| Signal ID | `S5` |
| Weight | 0.10 |
| Field | `Restaurant.description` |
| Condition | `description` is non-null AND `description.length >= 50` (characters, not bytes) |
| Notes | Whitespace-only descriptions do not count. The description stored in the database has been trimmed at intake. An admin editing the description to fewer than 50 characters causes this signal to be lost on the next recalculation. |

---

**Signal 6 — Street-Level Address**

| Property | Value |
|---|---|
| Signal ID | `S6` |
| Weight | 0.10 |
| Field | `Restaurant.address` |
| Condition | `address` is non-null AND `address.length >= 20` (characters, not bytes) |
| Notes | A 20-character minimum is a proxy for a street-level address (e.g., "14 Ahmadu Bello Way" is 19 characters and would not qualify; "14 Ahmadu Bello Way, VI" would). This is intentionally a heuristic, not a geocoded validation. |

---

**Signal 7 — Contact Channel Present**

| Property | Value |
|---|---|
| Signal ID | `S7` |
| Weight | 0.05 |
| Fields | `Restaurant.website`, `Restaurant.email` |
| Condition | At least one of `website` or `email` is non-null and non-empty |
| Notes | Either field satisfies the condition independently. Both being present does not add additional score. This signal rewards discoverability beyond the phone number. |

---

### 2.2 Signal Independence

Each signal is evaluated independently. Signals do not interact. A restaurant that earns S1, S3, and S4 earns exactly 0.20 + 0.15 + 0.25 = 0.600, regardless of any relationship between those signals.

### 2.3 Data Freshness at Calculation Time

The score is always calculated from the current state of the database at the moment of recalculation. The service fetches fresh data — it does not use cached or in-memory restaurant state passed from outside the service. This guarantees accuracy.

The query fetches:
- `Restaurant` (all fields: phone, description, address, website, email, verificationStatus)
- `RestaurantPhoto[]` (filtered: `restaurantId = ?`)
- `RestaurantDish[]` (filtered: `restaurantId = ?`, `deletedAt IS NULL`)

---

## 3. SCORE WEIGHTS

### 3.1 Weight Table

| Signal ID | Signal Name | Weight | Maximum Contribution |
|---|---|---|---|
| S1 | Valid phone number | 0.20 | 0.200 |
| S2 | At least one verified photo | 0.15 | 0.150 |
| S3 | Three or more active dishes | 0.15 | 0.150 |
| S4 | Admin verification (APPROVED) | 0.25 | 0.250 |
| S5 | Description ≥ 50 chars | 0.10 | 0.100 |
| S6 | Address ≥ 20 chars | 0.10 | 0.100 |
| S7 | Website or email present | 0.05 | 0.050 |
| | **Total** | **1.00** | **1.000** |

### 3.2 Weight Rationale

| Signal | Rationale |
|---|---|
| S4 (0.25) | The heaviest signal because it represents irreplaceable human judgement. No data-collection shortcut can substitute for an admin confirming the restaurant is legitimate. |
| S1 (0.20) | A reachable phone number is the primary mechanism for users to act on a discovery. Its absence makes a listing materially less useful. |
| S2 (0.15) | A verified photo distinguishes a real listing from a placeholder. Unverified photos have zero evidence value. |
| S3 (0.15) | A restaurant with fewer than 3 dishes offers insufficient discovery value. The dish inventory is the platform's core intelligence asset. |
| S5 (0.10) | Description improves search ranking and user context but is not operationally necessary. |
| S6 (0.10) | A street-level address enables users to find the restaurant. A vague address degrades trust. |
| S7 (0.05) | A secondary contact channel adds discoverability but is the least critical trust signal. |

### 3.3 Weight Immutability

Weights are defined as named constants in the implementation, not computed values. They must not be derived from configuration files, environment variables, or database records in Phase 1. Changing a weight requires a code change and a corresponding update to this document.

---

## 4. APPROVAL THRESHOLDS

### 4.1 Minimum Score at Approval

A restaurant may not be approved if its projected post-approval confidence score is below the minimum threshold.

| Threshold | Value | Rule |
|---|---|---|
| Minimum approval score | 0.400 | The service checks this BEFORE writing any state to the database |

### 4.2 How the Threshold Check Works

The threshold check is pre-commit. It follows this sequence:

1. Admin submits an approval action
2. State machine validates `PENDING_REVIEW → APPROVED` is allowed for this actor
3. Service **simulates** the score with `verificationStatus` treated as `APPROVED` (even though the DB has not yet been updated)
4. If simulated score < 0.400: return `422 Unprocessable Entity` with `code: SCORE_BELOW_THRESHOLD` — no database writes occur
5. If simulated score ≥ 0.400: execute the transaction (update statuses, persist score, write event)

The simulation uses the actual current data from the database but passes `verificationStatus = APPROVED` to the score calculator. This is the only place in the system where a score is calculated with a hypothetical status.

### 4.3 Minimum Pre-Approval Signal Requirement

Because S4 (APPROVED signal) contributes 0.250 to the score, and the approval threshold is 0.400, the non-APPROVED signals (S1 + S2 + S3 + S5 + S6 + S7) must sum to at least:

```
0.400 - 0.250 = 0.150
```

The minimum pre-approval signal combination to pass the threshold is any single signal worth ≥ 0.150:
- S1 alone (0.200) ✓
- S2 alone (0.150) ✓ — exactly at the minimum non-APPROVED contribution
- S3 alone (0.150) ✓ — exactly at the minimum
- Any two signals from S5, S6, S7 that sum to ≥ 0.150 ✓ (e.g., S5 + S6 = 0.200)

S7 alone (0.050) does not meet the minimum pre-approval contribution. A restaurant with only a contact channel cannot be approved.

### 4.4 SUPER Override of Threshold

A `SUPER` user can override the threshold gate. The override path:

1. SUPER sends the approval request with `{ forceApprove: true, reason: string }` in the request body
2. `reason` is required — the override fails if `reason` is absent or empty
3. The score is still calculated and persisted (the actual score, not a synthetic one)
4. The approval proceeds even if score < 0.400
5. A `VerificationEvent` is written with an additional `overrideReason` field in the event's metadata

The override does not change the score. It bypasses the gate. The restaurant's actual score (which may be below 0.400) is what gets persisted and used for search ranking.

### 4.5 No Upper Threshold

There is no maximum score required for approval. A restaurant may be approved at any score that meets the minimum, up to the theoretical maximum at approval time (1.000).

---

## 5. RECALCULATION TRIGGERS

### 5.1 Rule: Recalculate From Scratch, Never Increment

Every recalculation discards the current stored score and recomputes from the live state of all seven signals. There is no accumulated state. This prevents drift between the stored score and the actual facts.

### 5.2 Automatic Triggers

The following events trigger an automatic recalculation. The recalculation runs within the same database transaction as the triggering change.

| Trigger | Initiating System | Signals Potentially Affected |
|---|---|---|
| Status transition (any) | Verification Service | S4 (always), others unchanged |
| Photo marked as verified (`isVerified = true`) | Intelligence Service | S2 |
| Photo un-verified (`isVerified = false`) | Intelligence Service | S2 |
| New `RestaurantDish` created | Intelligence Service | S3 |
| `RestaurantDish` soft-deleted | Intelligence Service | S3 |
| `Restaurant.phone` updated | Intelligence Service | S1 |
| `Restaurant.description` updated | Intelligence Service | S5 |
| `Restaurant.address` updated | Intelligence Service | S6 |
| `Restaurant.website` updated | Intelligence Service | S7 |
| `Restaurant.email` updated | Intelligence Service | S7 |

### 5.3 Non-Triggers

The following changes do not trigger recalculation because they do not affect any signal:

- `Restaurant.name` updated
- `Restaurant.slug` updated
- `Restaurant.area` updated
- `Restaurant.priceRange` updated
- `Restaurant.cuisineTypes` updated
- `Restaurant.thumbnailUrl` updated
- `RestaurantDish.price` updated
- `RestaurantDish.nameAsServed` updated
- `RestaurantDish.description` updated
- `RestaurantDish.availabilityStatus` updated
- `RestaurantDish.verifiedAt` updated
- `RestaurantPhoto.caption` updated
- `RestaurantPhoto.isPrimary` updated
- `VerificationRecord.internalNotes` updated
- `VerificationRecord.feedbackToSubmitter` updated
- `VerificationRecord.assignedTo` updated

### 5.4 Transaction Requirement for Recalculations

Every recalculation must update both persistence locations within a single Prisma transaction:

```
1. The triggering data change (e.g., photo.isVerified = true)
2. restaurant.update({ confidenceScore: newScore })
3. verificationRecord.update({ confidenceScore: newScore, scoreBreakdown: newBreakdown })
```

If the transaction fails, no partial score update is committed. The stored score remains at its previous value.

---

## 6. MANUAL OVERRIDE RULES

### 6.1 Who Can Override

Only users with the `SUPER` role can manually override a confidence score. `ADMIN` role cannot.

### 6.2 Override Conditions

| Condition | Requirement |
|---|---|
| Actor role | `SUPER` only |
| Reason | Required — non-empty string, minimum 10 characters |
| Score value | Must be in range 0.000–1.000 |
| Restaurant status | Override allowed in any status except `DRAFT` |

### 6.3 What an Override Does

1. Sets `VerificationRecord.confidenceScore` to the override value
2. Sets `Restaurant.confidenceScore` to the override value
3. Overwrites `VerificationRecord.scoreBreakdown` with the override marker structure (see §6.4)
4. Writes a `VerificationEvent` with `reason` containing the override justification (see §7)

Both persistence locations are updated in a single transaction.

### 6.4 Score Breakdown During Override

When a score is manually overridden, the `scoreBreakdown` JSON is replaced with an override marker:

```json
{
  "overridden": true,
  "overriddenAt": "ISO-8601 timestamp",
  "overriddenBy": "admin-user-id",
  "overrideScore": 0.750,
  "overrideReason": "Legacy restaurant with verified presence; photo evidence confirmed offline",
  "lastComputedBreakdown": {
    "S1_phoneValid": 0.20,
    "S2_verifiedPhoto": 0.00,
    "S3_threeDishes": 0.15,
    "S4_adminApproved": 0.25,
    "S5_description": 0.10,
    "S6_detailedAddress": 0.10,
    "S7_contactChannel": 0.05,
    "total": 0.85
  }
}
```

The `lastComputedBreakdown` captures the computed score at the moment of override, providing a reference for future reviewers.

### 6.5 Override Persistence and Expiry

An override is NOT permanent. It is overwritten the next time any automatic recalculation trigger fires (see §5.2).

When the override is cleared by an automatic trigger:
- The score reverts to the freshly computed value
- `scoreBreakdown` reverts to the standard computed breakdown format
- No additional audit event is written for the reversion (the next standard event in the log makes the reversion visible implicitly)

The intent: overrides handle exceptional, time-bounded situations. They are not a permanent bypass of the scoring system.

### 6.6 Override API Contract

```
POST /api/v1/admin/verification/:restaurantId/score/override

Auth:   SUPER role only (403 for ADMIN)
Body:   { score: number, reason: string }
- score: 0.000–1.000 (422 if outside range)
- reason: non-empty string, minimum 10 chars (422 if missing or too short)
```

---

## 7. AUDIT REQUIREMENTS

### 7.1 What Is Recorded on Every Recalculation

On every score recalculation, the following is persisted:

| Record | Location | Content |
|---|---|---|
| New score | `Restaurant.confidenceScore` | The computed decimal value |
| New score (mirror) | `VerificationRecord.confidenceScore` | Same value — must match |
| Score breakdown | `VerificationRecord.scoreBreakdown` | JSON object with per-signal contributions and total |

The breakdown object persisted in every standard recalculation:

```json
{
  "S1_phoneValid": 0.20,
  "S2_verifiedPhoto": 0.15,
  "S3_threeDishes": 0.15,
  "S4_adminApproved": 0.25,
  "S5_description": 0.10,
  "S6_detailedAddress": 0.10,
  "S7_contactChannel": 0.05,
  "total": 1.000,
  "calculatedAt": "ISO-8601 timestamp",
  "trigger": "STATUS_TRANSITION | PHOTO_VERIFIED | DISH_ADDED | DISH_REMOVED | FIELD_UPDATED"
}
```

`trigger` is a string identifying which event caused the recalculation. It is for operational debugging and admin display.

### 7.2 What Is Recorded on Status-Transition Recalculations

When a recalculation is caused by a status transition, the `VerificationEvent` written for that transition contains the old and new scores:

```
VerificationEvent.reason (augmented format):
  "Admin approved. Score: 0.450 → 0.700"
```

The score delta is appended to the reason field. If the reason already has content (e.g., a rejection reason), the score delta is appended after a separator: `"Duplicate listing confirmed. | Score: 0.450 → 0.000"`

### 7.3 What Is Recorded on Manual Override

A manual override writes a `VerificationEvent` with the following structure. This event uses a distinct pattern to distinguish it from standard transitions:

```
VerificationEvent:
  fromStatus:  (current status — no status change occurs)
  toStatus:    (same as fromStatus — the status does not change)
  reason:      "SCORE_OVERRIDE: [admin's reason]. Score: 0.450 → 0.750"
  actorId:     super-user's ID
  actorRole:   SUPER
  ipAddress:   captured from request
```

**Note:** `fromStatus` and `toStatus` are identical in an override event. This is the only event type where they are equal. This makes overrides distinguishable in the audit log without adding a new event type.

### 7.4 Integrity Monitor

The data integrity monitor (run daily by admin tooling) includes this check:

```
Check: Restaurant.confidenceScore == VerificationRecord.confidenceScore
Expected: 100% match across all restaurant records
Alert if: Any divergence found
```

A divergence indicates a failed transaction that committed one update but not the other — a bug, not expected behaviour. Any divergence must be investigated and the source transaction identified.

### 7.5 What Is Not Audited

The following are deliberately not audited at the event level:

- Individual recalculation timing (the `calculatedAt` field in the breakdown is sufficient)
- The value of each signal at each recalculation (the breakdown captures this)
- Changes to non-scoring fields (address formatting, cuisineTypes, etc.)

---

## 8. EXAMPLES WITH WORKED CALCULATIONS

All examples use the signal weights from §3.1. Each example shows:
- The restaurant state
- Which signals are earned and which are not
- The arithmetic
- The resulting score and its band

---

### Example A — Bare Submission at Intake

**Scenario:** A restaurant has just been submitted with the minimum required data. No photos uploaded. Only one dish linked. No email or website. Description is a short sentence.

| Signal | ID | Condition | Earned? | Contribution |
|---|---|---|---|---|
| Valid phone | S1 | Phone provided, passes regex | ✓ Yes | 0.200 |
| Verified photo | S2 | No `isVerified = true` photos | ✗ No | 0.000 |
| 3+ dishes | S3 | Only 1 dish linked | ✗ No | 0.000 |
| Admin verified | S4 | Status is `PENDING_REVIEW` | ✗ No | 0.000 |
| Description ≥ 50 | S5 | Description is 35 characters | ✗ No | 0.000 |
| Address ≥ 20 | S6 | Address is "14 Broad Street, Lagos" (24 chars) | ✓ Yes | 0.100 |
| Website or email | S7 | Neither present | ✗ No | 0.000 |

**Score:** 0.200 + 0.100 = **0.300**  
**Band:** Low (0.250–0.499)  
**Approval eligible?** Yes — simulated post-approval score: 0.300 + 0.250 (S4) = **0.550** ≥ 0.400. The threshold gate passes.  
**Key point:** The threshold gate does not protect against sparse listings with only a phone and an address. An admin could approve this restaurant. This is deliberate: the threshold is a floor, not a quality target. Admin judgement — verifying at least one dish and one photo before approving — is the real quality gate. The confidence score communicates what is missing; the admin decides whether to act on it.

---

### Example B — Well-Prepared Submission Before Approval

**Scenario:** A submitter provided full restaurant details, uploaded 3 photos (none admin-verified yet), linked 5 dishes, and included a website. Restaurant is in `PENDING_REVIEW`.

| Signal | ID | Condition | Earned? | Contribution |
|---|---|---|---|---|
| Valid phone | S1 | Phone present, passes regex | ✓ Yes | 0.200 |
| Verified photo | S2 | 3 photos uploaded but none admin-verified | ✗ No | 0.000 |
| 3+ dishes | S3 | 5 dishes linked, none deleted | ✓ Yes | 0.150 |
| Admin verified | S4 | Status is `PENDING_REVIEW` | ✗ No | 0.000 |
| Description ≥ 50 | S5 | Description is 120 characters | ✓ Yes | 0.100 |
| Address ≥ 20 | S6 | Address is 45 characters | ✓ Yes | 0.100 |
| Website or email | S7 | Website present | ✓ Yes | 0.050 |

**Score:** 0.200 + 0.150 + 0.100 + 0.100 + 0.050 = **0.600**  
**Band:** Medium (0.500–0.699)  
**Approval eligible?** Simulated post-approval: 0.600 + 0.250 = 0.850. **Yes.**  
**Admin's next action:** Verify at least one photo before approving to push score to 0.750 + 0.250 = 1.000.

---

### Example C — High-Quality Listing Post-Approval

**Scenario:** Same restaurant from Example B. Admin has now approved it and verified 2 of the 3 photos.

| Signal | ID | Condition | Earned? | Contribution |
|---|---|---|---|---|
| Valid phone | S1 | ✓ | ✓ Yes | 0.200 |
| Verified photo | S2 | 2 photos marked `isVerified = true` | ✓ Yes | 0.150 |
| 3+ dishes | S3 | 5 active dishes | ✓ Yes | 0.150 |
| Admin verified | S4 | Status is `APPROVED` | ✓ Yes | 0.250 |
| Description ≥ 50 | S5 | 120-char description | ✓ Yes | 0.100 |
| Address ≥ 20 | S6 | 45-char address | ✓ Yes | 0.100 |
| Website or email | S7 | Website present | ✓ Yes | 0.050 |

**Score:** 0.200 + 0.150 + 0.150 + 0.250 + 0.100 + 0.100 + 0.050 = **1.000**  
**Band:** Very High  
**Notes:** All signals met. This is the maximum achievable score.

---

### Example D — Approval Threshold Gate: Passes

**Scenario:** A restaurant has a phone number, a 60-character description, and a 25-character address. No photos. Only 2 dishes. No email or website. Admin attempts to approve.

**Pre-approval state:**
| Signal | Earned? | Contribution |
|---|---|---|
| S1 Valid phone | ✓ Yes | 0.200 |
| S2 Verified photo | ✗ No | 0.000 |
| S3 3+ dishes | ✗ No (only 2) | 0.000 |
| S4 Admin verified | ✗ No | 0.000 |
| S5 Description | ✓ Yes | 0.100 |
| S6 Address | ✓ Yes | 0.100 |
| S7 Contact | ✗ No | 0.000 |

**Pre-approval score:** 0.400  
**Simulated post-approval:** 0.400 + 0.250 = **0.650**  
**Threshold check:** 0.650 ≥ 0.400 → **PASSES**  
**Outcome:** Approval proceeds. Post-approval score persisted as 0.650.

---

### Example E — Approval Threshold Gate: Blocked

**Scenario:** A restaurant was submitted with no phone, a 30-character description, a website, and 1 dish. Admin attempts to approve.

**Pre-approval state:**
| Signal | Earned? | Contribution |
|---|---|---|
| S1 Valid phone | ✗ No | 0.000 |
| S2 Verified photo | ✗ No | 0.000 |
| S3 3+ dishes | ✗ No (only 1) | 0.000 |
| S4 Admin verified | ✗ No | 0.000 |
| S5 Description | ✗ No (30 chars < 50) | 0.000 |
| S6 Address | ✗ No | 0.000 |
| S7 Contact | ✓ Yes (website) | 0.050 |

**Pre-approval score:** 0.050  
**Simulated post-approval:** 0.050 + 0.250 = **0.300**  
**Threshold check:** 0.300 < 0.400 → **BLOCKED**  
**Outcome:** Service returns `422` with `code: SCORE_BELOW_THRESHOLD`. Admin sees a message explaining which signals are missing. No database writes occur.

---

### Example F — Post-Approval Correction: Score Drop

**Scenario:** A restaurant was approved and had a score of 0.650. An admin opens a post-approval quality review and transitions it `APPROVED → NEEDS_INFO` because a dish has been reported unavailable.

| Signal | Pre-Correction | Post-Correction |
|---|---|---|
| S4 Admin verified | ✓ (status was APPROVED) | ✗ (status is now NEEDS_INFO) |
| All others | Unchanged | Unchanged |

**Pre-correction score:** 0.650 (includes S4 = 0.250)  
**Post-correction score:** 0.650 − 0.250 = **0.400**  
**Band changes:** Medium → Low  
**Restaurant visibility:** Status is `NEEDS_INFO`. The search system filters to `APPROVED` only. This restaurant no longer appears in search results until status returns to `APPROVED`.

The score drop is automatic and immediate. It is part of the status transition transaction.

---

### Example G — Score Recalculation Sequence During Enrichment

**Scenario:** An admin reviews a newly submitted restaurant and enriches it before approving. This shows score evolution across multiple recalculations.

**State at receipt (PENDING_REVIEW):**
- Phone: valid. Description: 80 chars. Address: 30 chars. 2 dishes. No photos. No website.
- S1 + S5 + S6 = 0.200 + 0.100 + 0.100 = **Score: 0.400**

**Admin action 1: Add a third dish**
- S3 now earned
- 0.400 + 0.150 = **Score: 0.550** — Recalculation triggered by DISH_ADDED

**Admin action 2: Upload and verify a photo**
- S2 now earned
- 0.550 + 0.150 = **Score: 0.700** — Recalculation triggered by PHOTO_VERIFIED

**Admin action 3: Approve the restaurant**
- S4 now earned
- Simulated: 0.700 + 0.250 = 0.950 ≥ 0.400 → passes threshold
- 0.700 + 0.250 = **Score: 1.000** — Recalculation triggered by STATUS_TRANSITION

Each recalculation is a fresh computation. The 0.700 score before approval is not stored as an intermediate to build on — it is recomputed from all signals at each step.

---

### Example H — Manual Override and Reversion

**Scenario:** A SUPER user overrides the score of a restaurant (currently APPROVED at 0.550) to 0.800 because the admin has external evidence of quality not captured in the signal model.

**Override action:**
- SUPER submits `{ score: 0.800, reason: "Physical inspection confirmed high-quality establishment. Photo evidence held offline." }`
- Service sets `confidenceScore = 0.800` on both `Restaurant` and `VerificationRecord`
- `scoreBreakdown` is replaced with the override marker structure
- `VerificationEvent` is written with fromStatus = toStatus = APPROVED and reason = "SCORE_OVERRIDE: Physical inspection confirmed... Score: 0.550 → 0.800"

**Score while override is active:** 0.800

**Three weeks later, admin edits the phone number:**
- FIELD_UPDATED trigger fires for phone change
- Score is recomputed from scratch: the new phone is valid, all other signals unchanged
- Computed score: 0.550 (same as before, since the phone was already valid)
- Override marker is gone — `scoreBreakdown` now shows the standard computed breakdown
- Score reverts to **0.550**

No additional audit event is written for the reversion. The score history is visible by reading the sequence of events: SCORE_OVERRIDE at 0.800, then the next event (FIELD_UPDATED) implicitly shows the return to computed score.

---

## Appendix A — Breakdown JSON Schema (Reference)

Standard computation breakdown (stored in `VerificationRecord.scoreBreakdown`):

```json
{
  "S1_phoneValid": 0.20,
  "S2_verifiedPhoto": 0.15,
  "S3_threeDishes": 0.15,
  "S4_adminApproved": 0.25,
  "S5_description": 0.10,
  "S6_detailedAddress": 0.10,
  "S7_contactChannel": 0.05,
  "total": 1.000,
  "calculatedAt": "2026-05-31T14:22:00.000Z",
  "trigger": "STATUS_TRANSITION"
}
```

Each signal field is either the full weight value (earned) or `0.00` (not earned). No partial values.

---

## Appendix B — Signal Quick Reference

| ID | Signal | Weight | Key Condition |
|---|---|---|---|
| S1 | Valid phone | 0.20 | Passes `/^(\+?234\|0)[789][01]\d{8}$/` |
| S2 | Verified photo | 0.15 | ≥1 `RestaurantPhoto.isVerified = true` |
| S3 | 3+ dishes | 0.15 | ≥3 `RestaurantDish` where `deletedAt IS NULL` |
| S4 | Admin verified | 0.25 | `verificationStatus = APPROVED` |
| S5 | Description | 0.10 | `description.length >= 50` |
| S6 | Address | 0.10 | `address.length >= 20` |
| S7 | Contact channel | 0.05 | `website IS NOT NULL` OR `email IS NOT NULL` |

---

## Appendix C — Approval Threshold Decision Matrix

| Pre-Approval Score | Simulated Post-Approval | Gate Result |
|---|---|---|
| 0.000 – 0.149 | 0.250 – 0.399 | BLOCKED |
| 0.150 | 0.400 | PASSES (exactly at minimum) |
| 0.151 – 0.750 | 0.401 – 1.000 | PASSES |

The minimum pre-approval signal combination that allows approval is S2 or S3 alone (both = 0.150), or S1 alone (0.200), or any combination of S5 + S6 (0.100 + 0.100 = 0.200), or S5 + S7 + S6 etc.

S7 alone (0.050) cannot reach the minimum. S5 alone (0.100) cannot reach the minimum. S6 alone (0.100) cannot reach the minimum.

---

*This document governs the implementation of `confidence-score.service.ts`. Any deviation from these specifications is a defect in that service. Disputes between this document and any other document are resolved by escalation to master-architecture.md, then to this document as the authoritative confidence scoring source.*

# Chow Here — Restaurant Intake Track

**Status:** AUTHORITATIVE BLUEPRINT  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Documents:** master-architecture.md, backend-standards.md, security-standards.md, data-governance.md

---

## 0. PURPOSE

This track defines the complete system for accepting restaurant submissions from the public and internal staff. It governs the intake form design, validation pipeline, media upload flow, draft persistence, and the transition from `DRAFT` to `PENDING_REVIEW`.

The intake system is the first point of contact between the outside world and the platform's trusted data store. Its primary responsibility is to collect sufficient, clean, validated data to enable admin verification — not to accept everything that arrives.

**This is a blueprint, not implementation code.**

---

## 1. SYSTEM RESPONSIBILITIES

The Restaurant Intake System owns exactly these responsibilities:

| Responsibility | Description |
|---|---|
| Public submission form | Multi-step form for restaurant submission |
| Server-side validation | Zod schema validation of all submitted data |
| Draft persistence | Save valid submissions as `DRAFT` before review |
| Dish association | Link submitted dishes to the canonical DishTaxonomy |
| Media upload pipeline | Accept photos, validate, upload to Cloudinary |
| Status transition | Move from `DRAFT` → `PENDING_REVIEW` |
| Confirmation notifications | Email the submitter on receipt |
| Duplicate detection | Prevent duplicate restaurant submissions |

It does **not** own:
- Verification review logic (owned by Verification System)
- Admin UI for reviewing submissions (owned by Admin Platform)
- Slug generation (shared utility)
- Public-facing restaurant pages (owned by Restaurant Listing System)

---

## 2. ARCHITECTURE

### 2.1 Component Map

```
Public Intake Form (UI)
  → Multi-step form (Step 1: Restaurant Info, Step 2: Dishes, Step 3: Photos)
  → Client-side Zod validation (immediate feedback)
  → API: POST /api/v1/intake/restaurants
      → Server-side Zod validation
      → Duplicate check
      → Cloudinary upload (if photos included)
      → Prisma: create Restaurant (status: DRAFT)
      → Prisma: create RestaurantDish records
      → Prisma: create VerificationRecord (currentStatus: DRAFT)
      → Email: intake confirmation to submitter
      → Response: submission ID + confirmation
  → Admin notification queued (simple: DB flag, not a queue service)
```

### 2.2 Data Flow

```
Submitter fills form
  → Steps 1–3 completed
  → Client validates each step locally (Zod)
  → Final submission POST to /api/v1/intake/restaurants
  → Server validates full payload with IntakeSubmissionSchema
  → Duplicate check (name + city fuzzy match)
  → Photos uploaded to Cloudinary (if provided)
  → Restaurant created: status = DRAFT
  → VerificationRecord created: currentStatus = DRAFT
  → VerificationEvent created: toStatus = DRAFT, actorId = SYSTEM
  → Confirmation email sent via Resend
  → 201 response with submissionId
```

### 2.3 Module Location

```
features/restaurants/
├── components/
│   ├── IntakeForm/
│   │   ├── Step1RestaurantInfo.tsx
│   │   ├── Step2DishSelection.tsx
│   │   ├── Step3Photos.tsx
│   │   └── IntakeFormContainer.tsx
│   └── IntakeConfirmation.tsx
├── schemas/
│   ├── intake.schema.ts       ← Zod validation schemas
│   └── restaurant.schema.ts   ← Shared restaurant schemas
├── services/
│   ├── intake.service.ts      ← Intake business logic
│   ├── duplicate-check.service.ts
│   └── slug.service.ts
├── hooks/
│   └── useIntakeForm.ts
└── types/
    └── intake.types.ts
```

---

## 3. VALIDATION SCHEMA

### 3.1 IntakeSubmissionSchema

This is the authoritative schema for restaurant intake submissions. All fields listed are collected and validated. The schema is defined in `features/restaurants/schemas/intake.schema.ts`.

```
IntakeSubmissionSchema {

  // Step 1: Restaurant Identity
  name: string, min 2, max 150
  description: string?, max 500
  address: string, min 5, max 300
  city: string, from NigerianCitiesEnum
  state: string, from NigerianStatesEnum
  area: string?, max 100
  phone: string, Nigerian phone format validation
  email: string?, valid email format
  website: string?, valid URL format
  priceRange: BUDGET | MID | UPSCALE
  cuisineTypes: string[], min 1, max 5 items, each max 50 chars

  // Step 2: Dishes
  dishes: array, min 1, max 50 items {
    dishId: uuid              ← Must exist in DishTaxonomy
    nameAsServed: string?     ← max 150
    description: string?      ← max 300
    price: number?            ← positive decimal, max 99999.99
    availabilityStatus: DishAvailabilityStatus
  }

  // Step 3: Photos
  photos: array, max 5 items {
    cloudinaryPublicId: string   ← Already uploaded via /api/v1/intake/photos
    isPrimary: boolean
  }

  // Submitter identity (optional)
  submitterName: string?     ← max 100
  submitterEmail: string?    ← valid email (for notification)
  submitterNote: string?     ← max 500 (additional context for admin)
}
```

### 3.2 Validation Rules

1. `name` + `city` combination is checked for duplicates before saving
2. All `dishId` values must be validated against the DishTaxonomy table — invalid IDs reject the entire submission
3. `phone` must pass Nigerian phone number regex: `/^(\+?234|0)[789][01]\d{8}$/`
4. If more than one `photos` entry has `isPrimary: true`, return a 422 error
5. `priceRange` is a strict enum — no free-text price values
6. `cuisineTypes` is a free-text list but each entry is sanitized (trimmed, max length enforced)

---

## 4. PHOTO UPLOAD PIPELINE

### 4.1 Architecture Decision

Photos are NOT uploaded as part of the main intake form submission. They are uploaded in a separate prior step to avoid timeout issues on the main submission POST.

```
Step 3 of form:
  User selects photo
  → Client sends: POST /api/v1/intake/photos (multipart)
  → Server:
      → Validates file type (JPEG, PNG only)
      → Validates file size (max 5MB per photo)
      → Uploads to Cloudinary (restaurant_intake folder)
      → Returns cloudinaryPublicId
  → Client stores cloudinaryPublicId in form state
  → Final submission includes cloudinaryPublicId list (not raw files)
```

### 4.2 Photo Validation Rules

```
Accepted formats:    JPEG, PNG only
Maximum size:        5MB per photo
Maximum photos:      5 per submission
Minimum dimensions: 400px × 400px (enforced by Cloudinary transformation)
```

### 4.3 Cloudinary Configuration

```
Upload folder:    chowhere/intake/{year}/{month}
Public ID:        auto-generated by Cloudinary
Transformation:   Max width 1200px, max height 1200px, quality auto
Eager transform:  Thumbnail: 400×400 crop:fill
Moderation:       Cloudinary auto-moderation enabled (explicit content filter)
```

### 4.4 Orphaned Photo Cleanup

Photos uploaded via `/api/v1/intake/photos` but never referenced in a completed submission are orphaned. A cleanup job is run weekly (manual in Phase 1, via admin action or CLI script) to delete Cloudinary assets not referenced in any `RestaurantPhoto` record.

---

## 5. DUPLICATE DETECTION

### 5.1 Strategy

Before saving a submission, the intake service runs a duplicate check:

```
Duplicate check logic:
  1. Exact name + exact city match → DUPLICATE (reject)
  2. Fuzzy name match (pg_trgm similarity > 0.75) + same city → POSSIBLE_DUPLICATE
     → Save submission with a duplicate_flag = true
     → Admin sees this flag in verification queue
  3. No match → proceed normally
```

### 5.2 Implementation Location

Duplicate detection logic lives in `features/restaurants/services/duplicate-check.service.ts`.

The service takes `{ name: string, city: string }` and returns:
```typescript
type DuplicateCheckResult = 
  | { status: 'CLEAR' }
  | { status: 'EXACT_DUPLICATE'; existingId: string }
  | { status: 'POSSIBLE_DUPLICATE'; candidates: Array<{ id: string; name: string; similarity: number }> }
```

- `EXACT_DUPLICATE` → reject submission, return 409 with the existing restaurant's public slug
- `POSSIBLE_DUPLICATE` → allow submission to proceed, but flag `VerificationRecord.internalNotes` with the candidates

### 5.3 Database Query

```sql
-- Exact duplicate check
SELECT id, name FROM "Restaurant"
WHERE LOWER(name) = LOWER($1) AND city = $2 AND deleted_at IS NULL;

-- Fuzzy duplicate check (pg_trgm)
SELECT id, name, similarity(name, $1) AS sim
FROM "Restaurant"
WHERE city = $2 AND deleted_at IS NULL
  AND similarity(name, $1) > 0.75
ORDER BY sim DESC
LIMIT 5;
```

---

## 6. SUBMISSION STATUS TRANSITIONS

The intake system owns only the `DRAFT` → `PENDING_REVIEW` transition. All subsequent transitions are owned by the Verification System.

```
Status at creation:     DRAFT
After submission:       PENDING_REVIEW
```

The transition from `DRAFT` to `PENDING_REVIEW` happens immediately after the submission is validated and saved. There is no manual step between submission and entering the review queue.

### 6.1 VerificationEvent at Submission

When a restaurant submission is saved, the following event is written to `VerificationEvent`:

```
fromStatus:  null (initial)
toStatus:    DRAFT
actorId:     "SYSTEM"
actorRole:   SYSTEM (requires enum addition, or use a sentinel string)
reason:      "Restaurant intake submitted"
ipAddress:   request IP
```

When status transitions to `PENDING_REVIEW`:
```
fromStatus:  DRAFT
toStatus:    PENDING_REVIEW
actorId:     "SYSTEM"
reason:      "Intake validated and queued for review"
ipAddress:   request IP
```

---

## 7. CONFIRMATION NOTIFICATION

After a successful submission, the system sends a confirmation email via Resend.

### 7.1 Email Trigger

Triggered from `intake.service.ts` after the restaurant record is persisted.

### 7.2 Email Content

```
To:       submitterEmail (if provided)
From:     noreply@chowhere.app
Subject:  "Your restaurant submission has been received — Chow Here"

Body (React Email template):
  - Restaurant name
  - Confirmation reference number (submission ID, truncated)
  - Expected review timeline (e.g., "within 3–5 business days")
  - What happens next (verification process brief)
  - Contact email for questions
```

### 7.3 Email is Best-Effort

If email delivery fails (Resend API error), the submission is NOT rolled back. The submission persists. Email failure is logged but does not affect the submission outcome.

---

## 8. API ENDPOINT DEFINITIONS

### 8.1 POST /api/v1/intake/restaurants

**Purpose:** Submit a restaurant for review  
**Authentication:** Optional (anonymous allowed)  
**Rate limit:** 3 submissions per IP per hour

**Request body:** `IntakeSubmissionSchema`

**Success response:**
```json
{
  "success": true,
  "data": {
    "submissionId": "uuid",
    "message": "Submission received and is pending review."
  }
}
```

**Error responses:**
- `422` — Validation error (with field-level detail)
- `409` — Exact duplicate exists (with `existingSlug` in error data)
- `429` — Rate limit exceeded
- `500` — Server error

### 8.2 POST /api/v1/intake/photos

**Purpose:** Upload a single photo, receive Cloudinary public ID  
**Authentication:** Optional  
**Rate limit:** 20 photo uploads per IP per day  
**Content-Type:** `multipart/form-data`

**Success response:**
```json
{
  "success": true,
  "data": {
    "publicId": "chowhere/intake/2026/05/xyz123",
    "width": 1200,
    "height": 800,
    "thumbnailUrl": "https://res.cloudinary.com/..."
  }
}
```

**Error responses:**
- `400` — File validation failure (type, size, dimensions)
- `429` — Rate limit exceeded
- `500` — Upload failure

### 8.3 GET /api/v1/intake/dishes

**Purpose:** Search available dishes to attach to a submission  
**Authentication:** None  
**Query params:** `?q=jollof&limit=20`

Returns active DishTaxonomy entries matching the query. Used by the Step 2 dish selector.

---

## 9. SECURITY CONSIDERATIONS

### 9.1 Input Sanitization

All string inputs are trimmed and passed through Zod's `string().trim()`. No HTML is accepted in any field. URLs are validated via `z.string().url()`.

### 9.2 File Upload Security

- MIME type validation via `file-type` package (not just extension)
- Files are uploaded directly to Cloudinary — they never touch the application server's filesystem
- Maximum file size enforced at the API route level before any upload attempt
- Cloudinary auto-moderation enabled for explicit content

### 9.3 Rate Limiting

Rate limiting is enforced at the API route level. Phase 1 implementation uses a simple Redis-free approach: IP-based counts stored in a PostgreSQL `rate_limit` table with a TTL.

```
Table: RateLimit {
  id:         uuid
  key:        string   ← "intake:{ip}" or "photo_upload:{ip}"
  count:      int
  windowStart: DateTime
}
```

This avoids the operational cost of adding Redis in Phase 1. If throughput grows beyond PostgreSQL's capacity for rate limiting, Redis is the correct upgrade — but that is a Phase 2 decision.

### 9.4 Anonymous Submissions

Anonymous submissions (no authenticated user) are accepted. The `submittedBy` field on `Restaurant` is `null` for anonymous submissions. Anonymous submissions receive the same verification treatment as authenticated ones.

The submitter's email (if provided in the intake form) is stored in `VerificationRecord.submitterEmail`. This field exists specifically for this purpose — it is separate from `feedbackToSubmitter`, which is admin-written feedback text. The submitter's email is never stored directly on the `Restaurant` model and is never returned in any public-facing API response.

---

## 10. IMPLEMENTATION SEQUENCE

### Step 1: Validation Layer
1. Write `IntakeSubmissionSchema` in `features/restaurants/schemas/intake.schema.ts`
2. Write `PhotoUploadSchema`
3. Write unit tests for all edge cases in validation schemas

### Step 2: Services
1. Write `intake.service.ts` — orchestrates creation
2. Write `duplicate-check.service.ts` — fuzzy match logic
3. Write `slug.service.ts` — generate unique URL slug from restaurant name

### Step 3: Photo Upload API
1. Implement `POST /api/v1/intake/photos`
2. Integrate Cloudinary SDK
3. Validate file type, size, dimensions
4. Return public ID

### Step 4: Intake Submission API
1. Implement `POST /api/v1/intake/restaurants`
2. Wire validation → duplicate check → persist → email
3. Write integration tests

### Step 5: Dish Search API
1. Implement `GET /api/v1/intake/dishes`
2. Wire to DishTaxonomy FTS query

### Step 6: UI (After API is complete and tested)
1. Build `IntakeFormContainer` with multi-step state
2. Build Step 1, Step 2, Step 3 components
3. Wire to API endpoints with TanStack Query
4. Build `IntakeConfirmation` screen

---

## 11. KNOWN RISKS AND EDGE CASES

| Risk | Mitigation |
|---|---|
| Submitter provides invalid dish IDs | Server validates every dishId against DishTaxonomy — invalid IDs cause 422 |
| Duplicate restaurant submitted by different users | Duplicate detection runs before save; possible duplicates are flagged for admin |
| Photo upload succeeds but submission fails | Orphaned photo cleanup job; photos are soft-linked only after submission saves |
| Large photo uploads slow the form | Photos uploaded independently before final submission; final submission has no file payload |
| Submitter provides wrong phone format | Nigerian phone regex validation with clear error message |
| City not in Nigeria list | City validated against `NigerianCitiesEnum`; free text not accepted |
| Malformed URL in website field | Zod `z.string().url()` validation with explicit error message |

---

*Governed by master-architecture.md, backend-standards.md, and security-standards.md. All conflicts resolved by those documents.*

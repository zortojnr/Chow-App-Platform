# Chow Here — Data Governance

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Document:** master-architecture.md

---

## 0. PURPOSE

This document defines how data is structured, owned, validated, protected, and maintained on the Chow Here platform. It covers the canonical data model, field-level ownership rules, data quality standards, lifecycle policies, and the governance principles that protect the trust moat.

Data governance is not a compliance exercise. It is the mechanism by which the quality of Chow Here's intelligence is enforced over time.

---

## 1. DATA QUALITY PHILOSOPHY

### 1.1 Quality Over Volume

The central data principle of Chow Here:

> **150 high-quality, verified records are worth more than 5,000 unverified records.**

This means:
- Every record in the production database has gone through a quality gate
- Unverified data is never surfaced to end users
- Data quality degrades slowly over time without active maintenance — this must be designed against

### 1.2 Data Quality Dimensions

Data quality on Chow Here is measured across five dimensions:

| Dimension | Definition | Enforced By |
|---|---|---|
| **Accuracy** | The data reflects reality (restaurant serves the dish) | Verification workflow |
| **Completeness** | Required fields are populated | Zod schema validation |
| **Consistency** | Same concepts use the same terms (taxonomy) | Dish taxonomy + admin enforcement |
| **Timeliness** | Data reflects the current state (menu changes) | Availability flags + re-verification |
| **Trustworthiness** | Source of data is known and accountable | Audit trail on all records |

Every system and process must support these dimensions. When in doubt, favor accuracy over completeness.

---

## 2. CANONICAL DATA MODEL

### 2.1 Core Entities

The Chow Here data model has the following core entities:

```
DishTaxonomy          — The canonical catalog of Nigerian dishes
Restaurant            — A physical restaurant entity
RestaurantDish        — A dish served at a specific restaurant
User                  — A platform user (consumer)
VerificationRecord    — The verification state and history for a restaurant
VerificationEvent     — An immutable audit log entry for verification actions
SavedDish             — A user's saved/bookmarked dish-restaurant pair
SearchLog             — Anonymous search query log
AdminUser             — Internal team members with elevated access
```

### 2.2 Entity Relationship Overview

```
DishTaxonomy (1) ──────────────── (N) RestaurantDish
                                           │
Restaurant (1) ─────────────────── (N) RestaurantDish
      │
      └── (1) VerificationRecord
                    │
                    └── (N) VerificationEvent

User (1) ──────────────────────── (N) SavedDish
SavedDish ─── references ──────── RestaurantDish
```

### 2.3 Entity Ownership Rules

Each entity has a single **owning system**. Only the owning system may create or materially modify records of that type.

| Entity | Owning System | May Not Be Modified By |
|---|---|---|
| `DishTaxonomy` | Admin Platform | Restaurant submitters, users |
| `Restaurant` | Restaurant Intake System | Users, search |
| `RestaurantDish` | Restaurant Intake System / Admin | Users |
| `VerificationRecord` | Verification System | Any other system |
| `VerificationEvent` | Verification System | Anyone (append-only) |
| `SavedDish` | User Account System | Admins, restaurants |
| `SearchLog` | Search System | Anyone (append-only) |

---

## 3. FIELD-LEVEL DATA STANDARDS

### 3.1 Restaurant Record Fields

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | System-generated. Never mutable. |
| `name` | String | 2–150 chars. Trimmed. No HTML. |
| `slug` | String | URL-safe, unique. Derived from name. Immutable after first approval. |
| `address` | String | 5–300 chars. Physical address in Nigeria. |
| `city` | Enum | Must be a value from the Nigerian cities allowlist. |
| `state` | Enum | Must be a Nigerian state. |
| `area` | String | Optional. Neighborhood within city. 2–100 chars. |
| `phone` | String | Nigerian format: `+234XXXXXXXXXX`. Validated by regex. |
| `verificationStatus` | Enum | DRAFT → PENDING_REVIEW → APPROVED / REJECTED / NEEDS_INFO. Managed by VerificationService only. |
| `confidenceScore` | Decimal | 0.00 to 1.00. Calculated by system. Not user-editable. |
| `priceRange` | Enum | BUDGET / MID / UPSCALE |
| `thumbnailUrl` | String | Cloudinary CDN URL. Validated format. |
| `deletedAt` | DateTime | Null = active. Soft delete only. |
| `createdAt` | DateTime | System-set. Immutable. |
| `updatedAt` | DateTime | System-set on every update. |

### 3.2 Dish Taxonomy Fields

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | System-generated. |
| `canonicalName` | String | 2–150 chars. The authoritative English dish name. Unique. |
| `aliases` | String[] | All regional and colloquial names. Each 1–150 chars. |
| `category` | Enum | Rice, Soup, Protein, Swallow, Snack, Drink, Dessert, Street Food |
| `subcategory` | String | Optional. 2–100 chars. |
| `description` | String | Optional. Up to 500 chars. No HTML. |
| `isActive` | Boolean | Inactive dishes are hidden from search and intake. |

### 3.3 RestaurantDish Fields

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | System-generated. |
| `restaurantId` | UUID | FK to Restaurant. |
| `dishId` | UUID | FK to DishTaxonomy. |
| `nameAsServed` | String | Optional. How this restaurant names the dish. Max 150 chars. |
| `description` | String | Optional. This restaurant's description. Max 300 chars. No HTML. |
| `price` | Decimal | Optional. Price in Naira. Must be positive. |
| `availabilityStatus` | Enum | ALWAYS_AVAILABLE / SEASONAL / WEEKEND_ONLY / ON_ORDER / UNKNOWN |
| `verifiedAt` | DateTime | When admin confirmed this dish is served here. Null if not yet verified. |

### 3.4 Forbidden Field Patterns

The following field patterns are never acceptable:

- Free-form "notes" text fields exposed to the public without admin review
- Boolean flags named `is_trusted`, `is_fake`, `is_spam` — use the verification status system
- Fields that duplicate information from the taxonomy (don't store category on RestaurantDish — join to the taxonomy)
- NULL in fields where a sensible default exists (use the default)

---

## 4. DATA LIFECYCLE POLICIES

### 4.1 Restaurant Record Lifecycle

```
DRAFT
  ↓ (submitter action: submit for review)
PENDING_REVIEW
  ↓              ↘              ↘
APPROVED      REJECTED      NEEDS_INFO
  ↓                              ↓
(live in         (removed     (submitter
 search)          from queue)  must respond)
```

**Approved restaurants** are visible in search and on the platform.

**Rejected restaurants** are hidden but retained in the database for audit purposes. They may be re-submitted.

**Draft restaurants** are visible only to the submitter (if authenticated) and admins. They do not appear in search.

### 4.2 Soft Delete Policy

Records are never hard-deleted except in specific cases:

| Entity | Deletion Policy |
|---|---|
| Restaurant | Soft delete (`deletedAt`). Admin-initiated only. |
| RestaurantDish | Soft delete. Keeps integrity of history. |
| User | Soft delete + PII anonymization (email, phone). |
| DishTaxonomy | Soft delete (`isActive = false`). Never removed. |
| VerificationEvent | Never deleted. Append-only. |
| SearchLog | Auto-purged after 90 days (no PII). |
| SavedDish | Hard delete on user request (no retention value). |

### 4.3 Re-verification Policy

Approved restaurants are subject to re-verification if:
- A user reports a dish as no longer available
- The restaurant has not been updated in > 6 months
- Contact details become unreachable

Re-verification resets `confidenceScore` to a pending state and reduces it until re-confirmation is complete. This prevents stale data from maintaining high scores.

**Phase 1:** Re-verification is a manual admin action. Phase 2 may automate triggers.

### 4.4 Data Retention Summary

| Data Type | Retention Period | Notes |
|---|---|---|
| Approved restaurant records | Indefinite | Core platform intelligence |
| Rejected submission records | 2 years | Audit and fraud detection |
| Draft records (abandoned) | 30 days | Auto-purge if no activity |
| Verification events | Indefinite | Immutable audit log |
| Search logs | 90 days | Anonymized; for taxonomy improvement |
| User activity history | Indefinite (while account active) | Deleted with account |
| Deleted user PII | 0 days after deletion | Immediately anonymized |

---

## 5. TAXONOMY GOVERNANCE

### 5.1 Taxonomy is Centrally Managed

The dish taxonomy is not crowdsourced. It is maintained by the internal team (ADMIN / SUPER roles). Restaurant submitters propose dish names, but the taxonomy team canonicalizes them.

**Why:** If users could freely add dish names, the taxonomy becomes polluted with duplicates, misspellings, and fragmentation. Search quality degrades immediately.

### 5.2 Adding a New Dish to the Taxonomy

Process for adding a new canonical dish:

1. Admin receives a submission with an unrecognized dish name
2. Admin searches the taxonomy for near-matches (aliases, misspellings)
3. If the dish is genuinely new: Admin creates a new taxonomy entry with:
   - Canonical English name
   - At minimum one alias
   - Category
   - Optional description
4. The submitter's dish name is added as an alias if it is a valid regional variant
5. Taxonomy change is recorded with admin user ID and timestamp

### 5.3 Alias Management Rules

- Aliases must be genuine regional names, colloquial names, or misspellings in common use
- Do not add brand names as aliases (e.g., "Mr. Bigg's Jollof Rice" is not an alias for Jollof Rice)
- Duplicate aliases across different dishes are not permitted — an alias belongs to exactly one canonical dish
- All aliases are stored lowercased and trimmed

### 5.4 Category Definitions

| Category | Examples |
|---|---|
| Rice Dishes | Jollof Rice, Fried Rice, Ofada Rice, Coconut Rice |
| Soups | Egusi Soup, Efo Riro, Ogbono Soup, Banga Soup |
| Swallow | Pounded Yam, Eba, Fufu, Semovita, Amala, Tuwo |
| Protein | Suya, Asun, Nkwobi, Peppered Chicken, Isi Ewu |
| Street Food | Akara, Puff Puff, Boli, Roasted Corn |
| Drinks | Zobo, Kunu, Palm Wine, Chapman |
| Snacks | Chin Chin, Small Chops, Spring Roll |
| Breakfast | Akara and Pap, Yam and Egg, Beans |

Categories are an enum. New categories require a taxonomy governance review and a migration.

---

## 6. DATA VALIDATION ARCHITECTURE

### 6.1 Validation Layers

Data validation is a chain of responsibility, not a single gate:

```
Layer 1: Client-side (Zod)       — UX feedback, not authoritative
Layer 2: API boundary (Zod)      — Authoritative input validation
Layer 3: Service layer (types)   — Type safety only, input already clean
Layer 4: Database (constraints)  — Last-resort backstop
```

**Every layer plays a role. Removing any layer creates a gap.**

### 6.2 Database Constraints as Backstop

Database-level constraints are the last line of defense. They catch bugs in application code that pass invalid data through layers 1–3:

Required DB constraints:
```sql
-- Restaurant
ALTER TABLE "Restaurant" ADD CONSTRAINT check_confidence_score 
  CHECK (confidence_score >= 0 AND confidence_score <= 1);

ALTER TABLE "Restaurant" ADD CONSTRAINT check_price_range 
  CHECK (price_range IN ('BUDGET', 'MID', 'UPSCALE'));

-- RestaurantDish
ALTER TABLE "RestaurantDish" ADD CONSTRAINT check_price_positive
  CHECK (price IS NULL OR price > 0);

-- DishTaxonomy
ALTER TABLE "Dish" ADD CONSTRAINT check_canonical_name_nonempty
  CHECK (length(trim(canonical_name)) > 0);
```

These constraints are defined in Prisma schema as raw SQL additions in migrations.

---

## 7. DATA ACCESS GOVERNANCE

### 7.1 Read Access Rules

| Data | Public | Authenticated User | Admin |
|---|---|---|---|
| Approved restaurant profile | ✅ | ✅ | ✅ |
| Approved dish list for restaurant | ✅ | ✅ | ✅ |
| Unverified/draft restaurant | ❌ | ❌ | ✅ |
| Rejected restaurant | ❌ | ❌ | ✅ |
| Verification events | ❌ | ❌ | ✅ |
| Another user's saved dishes | ❌ | ❌ | ❌ |
| Own saved dishes | ❌ | ✅ | ✅ |
| Search logs | ❌ | ❌ | ✅ |
| Confidence score breakdown | ❌ | ❌ | ✅ |

### 7.2 Write Access Rules

| Action | Public | Auth User | Admin | Super |
|---|---|---|---|---|
| Submit restaurant for review | ✅ | ✅ | ✅ | ✅ |
| Edit own submitted (draft) restaurant | ✅* | ✅* | ✅ | ✅ |
| Edit approved restaurant | ❌ | ❌ | ✅ | ✅ |
| Approve / reject restaurant | ❌ | ❌ | ✅ | ✅ |
| Add dish to taxonomy | ❌ | ❌ | ✅ | ✅ |
| Delete any record | ❌ | ❌ | ❌ | ✅ |
| Override confidence score | ❌ | ❌ | ❌ | ✅ |

*\* Public submitters can only edit while in DRAFT or NEEDS_INFO status. Once PENDING_REVIEW, the restaurant is locked for editing.*

---

## 8. AUDIT TRAIL STANDARDS

### 8.1 What Must Be Audited

Every action on the following must produce an immutable audit record:

- Restaurant verification status changes
- Confidence score overrides
- Dish taxonomy additions and modifications
- Admin role assignments
- Account deletions with PII anonymization

### 8.2 Audit Record Shape

```typescript
interface AuditEvent {
  id: string
  entityType: 'RESTAURANT' | 'DISH_TAXONOMY' | 'USER' | 'VERIFICATION'
  entityId: string
  action: string              // e.g., 'STATUS_CHANGE', 'DISH_ADDED'
  actorId: string             // Admin user ID
  actorRole: UserRole
  before: Record<string, unknown> | null  // JSON snapshot before change
  after: Record<string, unknown> | null   // JSON snapshot after change
  reason: string | null       // Required for status changes, optional otherwise
  ipAddress: string
  createdAt: Date             // Immutable timestamp
}
```

Audit records are never updated or deleted. If a mistake was made, a corrective audit record is added — the mistaken record is not erased.

---

## 9. DATA IMPORT AND MIGRATION STANDARDS

### 9.1 Initial Data Load

The dish taxonomy will be loaded from a curated data file before any public launch. This initial seed data:

- Is reviewed by at least one team member before import
- Is imported via a versioned migration script, not ad-hoc SQL
- Produces an audit record indicating bulk import with the import file hash

### 9.2 Schema Migration Rules

All schema changes are via Prisma migrations. Additional rules:

| Change Type | Process |
|---|---|
| Add a nullable column | Safe: direct migration |
| Add a NOT NULL column with default | Safe: migration with default value |
| Add a NOT NULL column without default | Risky: requires data backfill migration |
| Rename a column | Forbidden: add new column, migrate data, remove old |
| Remove a column | Forbidden in production: soft-remove first, hard-remove after 2 sprint cycles |
| Add an index | Safe: `CREATE INDEX CONCURRENTLY` to avoid table lock |
| Change an enum | Requires migration with explicit mapping |

### 9.3 Zero-Downtime Migration Strategy

Production migrations must not cause downtime. The pattern for schema changes:

```
Step 1: Deploy code that handles BOTH old and new schema
Step 2: Run migration (add column/index)
Step 3: Backfill data if needed
Step 4: Deploy code that uses only new schema
Step 5: Remove old compatibility code
```

Never deploy a migration and new code simultaneously if the code requires the migration to be complete first.

---

## 10. DATA INTEGRITY MONITORS

Phase 1 requires the following data integrity checks, run daily by the admin dashboard:

| Check | Expected Result | Alert If |
|---|---|---|
| Restaurants with `APPROVED` status but no verified dishes | 0 | > 0 |
| RestaurantDish records pointing to inactive taxonomy entries | 0 | > 0 |
| Restaurants with confidence_score = 1.0 but unverified photos | 0 | > 0 |
| Orphaned VerificationRecords (no restaurant) | 0 | > 0 |
| Users with `ADMIN` role not in the expected admin list | 0 | > 0 |

These are integrity invariants. A violation means a bug in the application or data. Each alert generates a task in the admin queue.

---

*Governed by master-architecture.md. All conflicts resolved by that document.*

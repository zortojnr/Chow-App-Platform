# Chow Here — Project Status v1

**Date:** 2026-06-05  
**Test count:** 927 tests · 35 test files · 0 failures  
**TypeScript:** 0 errors (clean build)  
**Purpose:** Authoritative continuation guide for future sessions. Base this document on the actual codebase, not assumptions. If a new session conflicts with anything here, verify against the code before overriding.

---

## 1. Project Vision

Chow Here is a **trusted dish-first Nigerian food discovery platform**. Users search for dishes — not restaurant names — and find verified restaurants that serve them.

The core product guarantee: every restaurant listing has been verified by a human admin, every dish has been confirmed at that restaurant, and every search result reflects trusted intelligence. This guarantee is not a feature — it is the product. Any change that increases listing volume at the expense of listing quality must be rejected.

---

## 2. Business Goals

| # | Goal | Status |
|---|---|---|
| BO-1 | Capture restaurant submissions from the public | API complete; UI pending |
| BO-2 | Route every submission through human admin review | Service + API complete; Admin UI pending |
| BO-3 | Produce a confidence score ≥ 0.40 for every approved listing | Scoring service complete; threshold enforced at approval |
| BO-4 | Enable admins to request additional information | NEEDS_INFO flow complete end-to-end (service + API) |
| BO-5 | Collect structured dish intelligence during verification | Intelligence service + API complete |
| BO-6 | Immutable audit trail for all admin actions | VerificationEvent append-only log complete |
| BO-7 | Notify submitters at key milestones | Notification service + email templates complete |
| BO-8 | Prevent low-trust data from reaching search | Enforced by verificationStatus gate; no APPROVED without score ≥ 0.40 |

**Not in scope for Phase 1:** food delivery, reservations, social feeds, AI recommendations, restaurant SaaS dashboards, external developer APIs, loyalty or payments (Paystack stub only).

---

## 3. Architecture Overview

**Architectural pattern:** Feature-based monolith. No microservices. No speculative infrastructure.

**Hosting:**
- Application: Vercel (Next.js App Router)
- Database: Supabase (PostgreSQL with PgBouncer pooling)
- Media: Cloudinary CDN
- Email: Resend + React Email templates
- Auth: NextAuth.js v4 (JWT strategy, CredentialsProvider)

**Request flow:**
```
User Request
  → Vercel CDN (static/cached)
  → Next.js App Router (server components, layouts)
  → Feature Module (business logic in features/)
  → Prisma ORM
  → PostgreSQL (Supabase)
  → Typed, validated response
```

**Feature module rule:** Feature modules do not import from each other directly. Cross-feature communication goes through `lib/` shared utilities or via API routes. Each feature module exposes only what is in its `index.ts` barrel file.

**Implementation sequence law:** Schema → Service → API → UI. No exceptions.

---

## 4. Current Database State

**Status:** Complete and migrated to Supabase. All migrations committed to the repository.

### Schema models

| Model | Purpose |
|---|---|
| `User` | Platform users — regular, admin, and super. Has `isActive` flag and soft-delete. |
| `DishTaxonomy` | Canonical Nigerian dish catalog. Includes FTS search vector (trigger-populated). |
| `Restaurant` | Restaurant records from draft through approval. Includes FTS search vector. |
| `RestaurantDish` | Junction: a dish as served at a specific restaurant. Soft-deleteable. |
| `RestaurantPhoto` | Photos for a restaurant. `isVerified` and `isPrimary` set by admins. |
| `VerificationRecord` | One-to-one with Restaurant. Tracks status, score, score breakdown, submitter email, and admin notes. |
| `VerificationEvent` | Append-only audit log of every status transition. Immutable. |
| `SavedDish` | User's saved dish-restaurant pairs. |
| `UserSearchHistory` | Per-user search query history. |
| `SearchLog` | Anonymous search log for analytics. |
| `UsedVerificationToken` | Stores SHA-256 hashes of consumed NEEDS_INFO response tokens. Prevents replay. |
| `RateLimit` | PostgreSQL-backed rate limiting table. No Redis required in Phase 1. |

### Enums

- `UserRole`: `USER`, `ADMIN`, `SUPER`, `SYSTEM` (SYSTEM is actor-only for VerificationEvent — never assigned to User.role)
- `VerificationStatus`: `DRAFT`, `PENDING_REVIEW`, `NEEDS_INFO`, `APPROVED`, `REJECTED`
- `DishCategory`: `RICE_DISHES`, `SOUPS`, `SWALLOW`, `PROTEIN`, `STREET_FOOD`, `DRINKS`, `SNACKS`, `BREAKFAST`, `DESSERTS`
- `PriceRange`: `BUDGET`, `MID`, `UPSCALE`
- `DishAvailabilityStatus`: `ALWAYS_AVAILABLE`, `SEASONAL`, `WEEKEND_ONLY`, `ON_ORDER`, `UNKNOWN`

### Migrations applied

| Migration | Content |
|---|---|
| `001_enable_extensions` | Enables `uuid-ossp` and `pg_trgm` extensions |
| `20260530112858_initial_schema` | Full initial schema |
| `20260530120832_add_fts_triggers` | FTS trigger on Restaurant.searchVector and DishTaxonomy.searchVector |
| `20260530120833_add_partial_indexes` | Partial indexes for performance (verificationStatus, city, deletedAt) |
| `20260530120834_add_db_constraints` | Check constraints (score range, non-empty slug, etc.) |
| `20260603120000_add_user_isactive` | Adds `User.isActive` (boolean, default true) |

### Seed data

`prisma/seed/dishes.data.ts` — canonical Nigerian dish entries  
`prisma/seed/cities.data.ts` — Nigerian city enum values  
`prisma/seed/seed.ts` — seed runner

---

## 5. Completed Phases

### Phase 0 — Architecture Governance (COMPLETE)

All 12 governance documents exist in `docs/architecture/` and `docs/tracks/`:

**Architecture docs:**
- `master-architecture.md` — top-level engineering law
- `frontend-standards.md` — UI, components, state, forms
- `backend-standards.md` — API, services, DB access patterns
- `security-standards.md` — auth, RBAC, input validation, file uploads
- `testing-standards.md` — philosophy, coverage requirements, patterns
- `search-architecture.md` — full-text search and pg_trgm strategy
- `data-governance.md` — data ownership, lifecycle, retention
- `confidence-scoring-spec.md` — authoritative scoring specification

**Track docs:**
- `database-track.md` — schema design and migration plan
- `restaurant-intake-track.md` — intake form and submission pipeline
- `verification-system-track.md` — state machine and audit trail
- `search-system-track.md` — dish search and discovery
- `admin-platform-track.md` — admin queue and dashboard
- `track-02-verification-intelligence.md` — unified delivery plan for Track 2 (19-step sequence)

A 15-issue architecture audit was completed and all issues were resolved before any implementation began.

---

### Phase 1 — Database Track (COMPLETE)

Schema designed, all migrations applied, seed data in place. Supabase instance provisioned. PgBouncer pooling configured via dual `DATABASE_URL` / `DIRECT_URL` connection strings.

---

### Track 2, Phase A — Service Layer (COMPLETE)

All service-layer components built with full test coverage. These are the foundational building blocks for the entire verification and intelligence pipeline.

#### Phase A1 — Foundation
- `src/lib/auth.ts` — NextAuth.js configuration with CredentialsProvider, JWT strategy, `requireRole()` enforcer, `authorizeUser()` testable core, `hashPassword()`, `verifyPassword()`
- `src/lib/db.ts` — Dual Prisma client exports: `db` (with soft-delete filter + verificationStatus write guard) and `dbForVerification` (soft-delete only, for use exclusively by VerificationService)
- `src/lib/errors.ts` — Typed error hierarchy: `AppError`, `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `GoneError`
- `src/lib/api-response.ts` — Standardised response helpers: `successResponse`, `paginatedSuccessResponse`, `errorResponse`, `validationErrorResponse`, `rateLimitResponse`, `serverErrorResponse`
- `src/lib/rate-limit.ts` — PostgreSQL-backed rate limit check (no Redis)
- `src/lib/ip.ts` + `src/lib/ip.test.ts` — IP extraction from `x-forwarded-for` / `x-real-ip` headers (Vercel infrastructure)
- `prisma/schema.prisma` migration: `User.isActive` added

#### Phase A2 — Verification Feature Public API
- `features/verification/index.ts` — barrel file controlling cross-feature imports. Exports: `VerificationService`, `IntelligenceService`, and score breakdown types. Explicitly hides state machine internals, scoring constants, token service, notification service, and `dbForVerification`.

#### Phase A3 — Intelligence Service
- `features/verification/services/intelligence.service.ts` — admin-driven enrichment:
  - `verifyDish()` — sets `RestaurantDish.verifiedAt`, optional field updates, triggers score recalculation
  - `verifyPhoto()` — sets `RestaurantPhoto.isVerified` / `isPrimary`, triggers score recalculation only when `isVerified` changes
  - `updateAvailability()` — updates `availabilityStatus` (no score recalculation)
  - `updatePricing()` — updates `price` (no score recalculation)
  - `recalculateRestaurantIntelligence()` — updates allowed restaurant fields + triggers recalculation
  - `overrideScore()` — SUPER-only manual score override with audit event

---

### Track 2, Phase B — Route Handlers + Admin Services (COMPLETE)

All API route handlers built and tested. This is the current completion boundary.

#### Intake API (Step 6 in track-02 sequence)
- `app/api/v1/intake/restaurants/route.ts` — `POST`: anonymous intake submission, rate limit 3/IP/hour, Zod validation, calls intake.service.ts, returns 201 with submissionId
- `app/api/v1/intake/dishes/route.ts` — `GET`: DishTaxonomy typeahead (FTS + pg_trgm), min 2 chars, max 20 results, rate limit 60/IP/min
- `app/api/v1/intake/photos/route.ts` — `POST`: photo upload with magic-byte validation, EXIF strip via sharp, Cloudinary upload, rate limit 20/IP/day

#### Admin Verification API (Steps 11–12 in track-02 sequence)
- `app/api/v1/admin/verification/queue/route.ts` — `GET`: paginated + filtered queue (status, city, assignedTo, sort)
- `app/api/v1/admin/verification/[restaurantId]/route.ts` — `GET`: full restaurant detail for review screen
- `app/api/v1/admin/verification/[restaurantId]/approve/route.ts` — `POST`: approve transition
- `app/api/v1/admin/verification/[restaurantId]/reject/route.ts` — `POST`: reject transition (reason required)
- `app/api/v1/admin/verification/[restaurantId]/needs-info/route.ts` — `POST`: needs-info transition (feedbackToSubmitter required)
- `app/api/v1/admin/verification/[restaurantId]/assign/route.ts` — `POST`: soft-assign admin to record
- `app/api/v1/admin/verification/[restaurantId]/history/route.ts` — `GET`: full VerificationEvent audit log
- `app/api/v1/admin/verification/[restaurantId]/score/override/route.ts` — `POST`: SUPER-only score override

#### Admin Intelligence API (Step 14 in track-02 sequence)
- `app/api/v1/admin/restaurants/[restaurantId]/dishes/[dishId]/verify/route.ts` — `PATCH`: verify a dish
- `app/api/v1/admin/restaurants/[restaurantId]/photos/[photoId]/verify/route.ts` — `PATCH`: verify a photo
- `app/api/v1/admin/restaurants/[restaurantId]/intelligence/route.ts` — `PATCH`: update restaurant intelligence fields

#### Admin Services
- `features/admin/services/queue.service.ts` — `QueueService`: `getQueue()` (paginated, filtered), `getDetail()` (full restaurant for review screen), `getHistory()` (VerificationEvent log)

---

## 6. Current Implementation Status

### What is complete (service + API layer, fully tested)

```
src/lib/
  auth.ts                ✅ tested
  db.ts                  ✅ (Prisma extensions — soft-delete + write guard)
  errors.ts              ✅
  api-response.ts        ✅ tested
  rate-limit.ts          ✅
  ip.ts                  ✅ tested
  email.ts               ✅
  cloudinary.ts          ✅

features/restaurants/
  schemas/intake.schema.ts            ✅ tested
  schemas/nigeria.ts                  ✅ (Nigerian cities/states enum data)
  services/intake.service.ts          ✅ tested
  services/slug.service.ts            ✅ tested
  services/duplicate-check.service.ts ✅ tested

features/verification/
  index.ts                            ✅ (public API surface)
  schemas/transition.schema.ts        ✅ tested
  services/state-machine.ts           ✅ tested
  services/confidence-score.service.ts✅ tested
  services/response-token.service.ts  ✅ tested
  services/notification.service.ts    ✅ tested (Resend + React Email)
  services/verification.service.ts    ✅ tested
  services/intelligence.service.ts    ✅ tested

features/admin/
  schemas/queue.schema.ts             ✅ tested
  schemas/intelligence.schema.ts      ✅ tested
  services/queue.service.ts           ✅ tested

app/api/v1/intake/
  restaurants/route.ts                ✅ tested
  dishes/route.ts                     ✅ tested
  photos/route.ts                     ✅ tested

app/api/v1/admin/verification/
  queue/route.ts                      ✅ tested
  [restaurantId]/route.ts             ✅ tested
  [restaurantId]/approve/route.ts     ✅ tested
  [restaurantId]/reject/route.ts      ✅ tested
  [restaurantId]/needs-info/route.ts  ✅ tested
  [restaurantId]/assign/route.ts      ✅ tested
  [restaurantId]/history/route.ts     ✅ tested
  [restaurantId]/score/override/route.ts ✅ tested

app/api/v1/admin/restaurants/[restaurantId]/
  dishes/[dishId]/verify/route.ts     ✅ tested
  photos/[photoId]/verify/route.ts    ✅ tested
  intelligence/route.ts               ✅ tested

app/api/v1/restaurants/
  route.ts                            ✅ tested  (Step 3 — GET index)
  [slug]/route.ts                     ✅ tested  (Step 4 — GET profile)
  [slug]/dishes/route.ts              ✅ tested  (Step 5 — GET dishes)
```

### What is also complete

```
middleware.ts                  ✅ tested  (admin route protection — Layer 1 security gate)
```

### Layer A — Frontend Foundation (COMPLETE)

All frontend infrastructure required before page implementation:

```
app/globals.css                ✅  Design tokens, dark mode vars, base styles
app/layout.tsx                 ✅  Root layout — fonts (Fraunces, Plus Jakarta Sans, JetBrains Mono)
app/providers.tsx              ✅  TanStack Query + SessionProvider + Toaster
app/api/auth/[...nextauth]/route.ts  ✅  NextAuth App Router handler
app/login/page.tsx             ✅  Admin login — RHF + Zod, design-system §10.1 §10.2 §11.2 §17.2
app/admin/layout.tsx           ✅  Admin shell — AdminSidebar + dark mode (data-theme on <html>)
src/lib/utils.ts               ✅  cn() helper
src/lib/api.ts                 ✅  Typed fetch wrapper (apiGet, apiPost, apiPatch, apiGetPaginated)
src/stores/admin-prefs.store.ts ✅  Dark mode Zustand store (localStorage-persisted)
src/stores/auth.store.ts       ✅  Auth Zustand store
src/components/ui/             ✅  button, badge, skeleton, table, separator, tooltip, select, dialog, sonner
features/admin/components/layout/AdminSidebar.tsx   ✅  Design-system §10.5 §11.2 compliant
features/admin/components/layout/QueueBadge.tsx     ✅  60s polling, amber pill
features/admin/components/layout/DarkModeToggle.tsx ✅  §18 dark mode toggle
```

### Step 17 — Admin Queue UI (COMPLETE)

```
app/admin/queue/page.tsx                                     ✅  Server component + Suspense wrapper
features/admin/components/queue/QueueContent.tsx             ✅  Client — URL filter state, TanStack Query,
                                                                  skeleton, empty states, error banner,
                                                                  stagger animation, pagination
features/admin/components/queue/QueueFilters.tsx             ✅  Status/sort/assignedTo/city filter bar
features/verification/components/VerificationStatusBadge.tsx ✅  Shared — VerificationStatus → DS §10.4 badge
app/globals.css (rowFadeIn keyframe)                         ✅  DS §7.5 stagger animation
```

Design system coverage: §10.3, §10.4, §10.7, §11.1–11.3, §15.2, §16.3, §17.5, §7.4–7.5  
Accessibility: table role/scope, aria-busy, aria-live, aria-label on all interactive elements  
Mobile: Restaurant+Status+Score always visible; City at md+; Assigned+Age at lg+

### Track 3 — Restaurant Listing System (IN PROGRESS)

Steps 1–6 complete. Service law: Schema → Service → API → **UI ✅ (components)** → Pages.

```
app/(public)/layout.tsx                                      ✅  Step 1 — Consumer route group shell
                                                                  + ConsumerBottomNav (fixed bottom, ≤ lg)
                                                                  + safe-area-inset-bottom compliance
src/components/layout/ConsumerBottomNav.tsx                  ✅  Step 1 dependency — client nav bar,
                                                                  4 items, amber-500 active, usePathname
features/restaurants/services/restaurant-listing.service.ts  ✅  Step 2 — 3 methods:
                                                                  getRestaurantProfile(slug)
                                                                  getRestaurantDishes(restaurantId, params)
                                                                  getRestaurantIndex(params)
                                                                  Security: APPROVED-only gate, no raw score,
                                                                  no admin fields, isVerified photos only
features/restaurants/schemas/restaurant-index.schema.ts      ✅  Step 3 dependency — Zod query schema
                                                                  city, priceRange, page, limit
features/restaurants/schemas/restaurant-dishes.schema.ts     ✅  Step 5 dependency — Zod query schema
                                                                  category, page, limit
app/api/v1/restaurants/route.ts                              ✅  Step 3 — GET /api/v1/restaurants
                                                                  60/IP/min rate limit, no auth
                                                                  consumer-safe shape, trust-band fields,
                                                                  thumbnailBlurHash, no raw score
app/api/v1/restaurants/[slug]/route.ts                       ✅  Step 4 — GET /api/v1/restaurants/[slug]
                                                                  120/IP/min, consumer-safe profile,
                                                                  confidenceScoreBand, no admin fields
app/api/v1/restaurants/[slug]/dishes/route.ts                ✅  Step 5 — GET /api/v1/restaurants/[slug]/dishes
                                                                  60/IP/min, two-step delegation,
                                                                  APPROVED gate via profile check
features/restaurants/components/TrustBadge.tsx               ✅  Step 6 — green-500 bg, neutral-0 text (§6.2)
                                                                  EXCELLENT/STRONG/VERIFIED bands
                                                                  showBand prop for profile view
                                                                  TrustBadgeSkeleton
features/restaurants/components/RestaurantCard.tsx           ✅  Step 6 — 4:3 photo, Fraunces name,
                                                                  TrustBadge overlay, shadow-sm→shadow hover,
                                                                  featured prop (rounded-3xl), skeleton
features/restaurants/components/DishCard.tsx                 ✅  Step 6 — horizontal layout, confirmed accent,
                                                                  availability badges, ₦ price format,
                                                                  ShieldCheck confirmed indicator, skeleton
features/restaurants/components/PhotoGallery.tsx             ✅  Step 6 — mobile snap-scroll, md 2-col,
                                                                  lg 3-col, 1:1 aspect-square cells,
                                                                  N/M count badge (md:hidden),
                                                                  Camera empty state (§8.4), skeleton
features/restaurants/components/PhotoLightbox.tsx            ✅  Step 6 — fixed overlay, 300ms fade,
                                                                  Escape/Arrow keyboard nav, swipe 50px,
                                                                  body scroll lock, focus management,
                                                                  role="dialog" aria-modal
features/restaurants/components/RestaurantContactSection.tsx ✅  Step 6 — MapPin/Phone/Globe/Mail,
                                                                  Google Maps deep link (§10.3 only ext nav),
                                                                  tel:/mailto: links, skeleton
features/restaurants/components/index.ts                     ✅  Step 6 — barrel file
app/globals.css (scrollbar-none utility)                     ✅  Step 6 dependency — required by
                                                                  PhotoGallery horizontal snap-scroll
```

Design system coverage (Step 6): §6.2, §7.2, §7.3, §7.6, §8.1–8.6, §10.3, §10.4, §10.6, §10.10, §15.2, §16.2–16.3  
Accessibility: 44×44px touch targets, role="dialog" aria-modal, aria-live counters, focus management, WCAG AA  
Motion: all transitions ≤ 300ms, `@media (prefers-reduced-motion)` respected globally

**Track 3 remaining:**

Step 7: Pages — `/restaurants`, `/restaurants/[slug]`, `not-found.tsx`, `app/not-found.tsx`  

### What is NOT yet built

- `/restaurants` listing page (Step 7)
- `/restaurants/[slug]` profile page (Step 7)
- `not-found.tsx` route-level and `app/not-found.tsx` global (Step 7)
- `/submit` intake form (Steps 15–16 public UI)
- `/verify/respond` submitter response page (Step 16)
- `/admin/restaurants/[id]/review` admin review screen (Step 18)
- `/admin/restaurants/[id]/intelligence` intelligence edit screen (Step 19)
- Shared feature components still pending: `ConfidenceScoreWidget`, `DishVerifyCard`, `PhotoVerifyGrid`, `VerificationEventTimeline`, `IntakeFormContainer`, `DishTypeahead`

---

## 7. Current Test Counts

**Total:** 927 tests · 35 test files · 0 failures  
**Runner:** Vitest 4.1.7

| Test File | Scope |
|---|---|
| `src/lib/auth.test.ts` | authorizeUser, authOptions shape, JWT/session callbacks |
| `src/lib/ip.test.ts` | IP extraction from Vercel headers |
| `features/restaurants/schemas/intake.schema.test.ts` | Intake form Zod schema |
| `features/restaurants/services/slug.service.test.ts` | Slug generation edge cases |
| `features/restaurants/services/duplicate-check.service.test.ts` | Exact + fuzzy duplicate detection |
| `features/restaurants/services/intake.service.test.ts` | End-to-end intake orchestration |
| `features/verification/schemas/transition.schema.test.ts` | Zod schemas for admin action bodies |
| `features/verification/services/state-machine.test.ts` | All valid + forbidden transitions × all actor roles |
| `features/verification/services/confidence-score.service.test.ts` | All 7 signals, every combination, threshold enforcement |
| `features/verification/services/response-token.service.test.ts` | Token generation, validation, replay prevention |
| `features/verification/services/notification.service.test.ts` | All 4 email notification types |
| `features/verification/services/verification.service.test.ts` | approve, reject, requestInfo, processSubmitterResponse, assignAdmin |
| `features/verification/services/intelligence.service.test.ts` | verifyDish, verifyPhoto (with/without recalculation), recalculateRestaurantIntelligence, overrideScore |
| `features/admin/schemas/queue.schema.test.ts` | Queue query parameter parsing |
| `features/admin/schemas/intelligence.schema.test.ts` | Intelligence update schema |
| `features/admin/services/queue.service.test.ts` | getQueue, getDetail, getHistory |
| `app/api/v1/intake/restaurants/route.test.ts` | Intake submission API |
| `app/api/v1/intake/dishes/route.test.ts` | Dish typeahead API |
| `app/api/v1/intake/photos/route.test.ts` | Photo upload API |
| `app/api/v1/admin/verification/queue/route.test.ts` | Queue API |
| `app/api/v1/admin/verification/[restaurantId]/route.test.ts` | Restaurant detail API |
| `app/api/v1/admin/verification/[restaurantId]/approve/route.test.ts` | Approve API |
| `app/api/v1/admin/verification/[restaurantId]/reject/route.test.ts` | Reject API |
| `app/api/v1/admin/verification/[restaurantId]/needs-info/route.test.ts` | Needs-info API |
| `app/api/v1/admin/verification/[restaurantId]/assign/route.test.ts` | Assign API |
| `app/api/v1/admin/verification/[restaurantId]/history/route.test.ts` | History API |
| `app/api/v1/admin/verification/[restaurantId]/score/override/route.test.ts` | Score override API (SUPER-only) |
| `app/api/v1/admin/restaurants/[restaurantId]/dishes/[dishId]/verify/route.test.ts` | Dish verify API |
| `app/api/v1/admin/restaurants/[restaurantId]/photos/[photoId]/verify/route.test.ts` | Photo verify API |
| `app/api/v1/admin/restaurants/[restaurantId]/intelligence/route.test.ts` | Restaurant intelligence API |
| `app/api/v1/restaurants/route.test.ts` | Public restaurant index API |
| `app/api/v1/restaurants/[slug]/route.test.ts` | Public restaurant profile API |
| `app/api/v1/restaurants/[slug]/dishes/route.test.ts` | Public restaurant dishes API |

---

## 8. Dependency Graph

```
track-02-verification-intelligence.md
    └─ governs all implementation decisions for Steps 1–19

Step 1  state-machine.ts
Step 2  confidence-score.service.ts         ← depends on state-machine types
Step 3  response-token.service.ts           ← standalone (jose + db)
Step 4  notification.service.ts             ← standalone (Resend)
Step 5  intake.service.ts                   ← depends on slug.service, duplicate-check.service
    └─ slug.service.ts                      ← standalone
    └─ duplicate-check.service.ts           ← depends on db (pg_trgm raw SQL)
Step 6  verification.service.ts             ← depends on steps 1, 2, 3, 4
Step 7  intelligence.service.ts             ← depends on step 2
Step 8  photos/route.ts                     ← depends on cloudinary.ts, rate-limit.ts
Step 9  restaurants/route.ts                ← depends on intake.service.ts
Step 10 dishes/route.ts                     ← depends on db (DishTaxonomy FTS)
Step 11 admin/verification/queue/route.ts   ← depends on queue.service.ts, auth.ts
Step 12 admin/verification/[id]/*           ← depends on verification.service.ts, auth.ts
Step 13 verification/respond/[token]        ← depends on verification.service.ts
Step 14 admin/restaurants/*                 ← depends on intelligence.service.ts, auth.ts
Steps 15-19 UI layer                        ← depends on all of the above
```

**Shared infrastructure used by all routes:**
- `src/lib/db.ts` — dual Prisma clients
- `src/lib/auth.ts` — `authOptions`, `requireRole()`
- `src/lib/errors.ts` — error hierarchy
- `src/lib/api-response.ts` — response envelope helpers
- `src/lib/rate-limit.ts` — PostgreSQL-backed rate limiting
- `src/lib/ip.ts` — IP extraction for audit events

---

## 9. Public API Inventory

All routes are under `/api/v1/`. All responses use the standard envelope:  
`{ success: true, data: {...} }` or `{ success: false, error: { code, message, fields? } }`.

### Public Listing API (Track 3)

| Method | Route | Auth | Rate Limit | Status |
|---|---|---|---|---|
| GET | `/api/v1/restaurants` | None | 60/IP/min | ✅ Step 3 complete |
| GET | `/api/v1/restaurants/[slug]` | None | 120/IP/min | ✅ Step 4 complete |
| GET | `/api/v1/restaurants/[slug]/dishes` | None | 60/IP/min | ✅ Step 5 complete |

### Public Intake API

| Method | Route | Auth | Rate Limit | Status |
|---|---|---|---|---|
| POST | `/api/v1/intake/restaurants` | None | 3/IP/hour | ✅ |
| POST | `/api/v1/intake/photos` | None | 20/IP/day | ✅ |
| GET | `/api/v1/intake/dishes?q=&limit=` | None | 60/IP/min | ✅ |

### Submitter Response API

| Method | Route | Auth | Status |
|---|---|---|---|
| POST | `/api/v1/verification/respond/[token]` | JWT token (no session) | ❌ Not yet built (Step 13) |

### Admin Verification API

| Method | Route | Role | Status |
|---|---|---|---|
| GET | `/api/v1/admin/verification/queue` | ADMIN, SUPER | ✅ |
| GET | `/api/v1/admin/verification/[restaurantId]` | ADMIN, SUPER | ✅ |
| POST | `/api/v1/admin/verification/[restaurantId]/approve` | ADMIN, SUPER | ✅ |
| POST | `/api/v1/admin/verification/[restaurantId]/reject` | ADMIN, SUPER | ✅ |
| POST | `/api/v1/admin/verification/[restaurantId]/needs-info` | ADMIN, SUPER | ✅ |
| POST | `/api/v1/admin/verification/[restaurantId]/assign` | ADMIN, SUPER | ✅ |
| GET | `/api/v1/admin/verification/[restaurantId]/history` | ADMIN, SUPER | ✅ |
| POST | `/api/v1/admin/verification/[restaurantId]/score/override` | SUPER only | ✅ |

### Admin Intelligence API

| Method | Route | Role | Status |
|---|---|---|---|
| PATCH | `/api/v1/admin/restaurants/[restaurantId]/dishes/[dishId]/verify` | ADMIN, SUPER | ✅ |
| PATCH | `/api/v1/admin/restaurants/[restaurantId]/photos/[photoId]/verify` | ADMIN, SUPER | ✅ |
| PATCH | `/api/v1/admin/restaurants/[restaurantId]/intelligence` | ADMIN, SUPER | ✅ |

---

## 10. Verification Platform Summary

The verification platform is the state machine and orchestration layer that governs every restaurant's journey from raw submission to trusted listing.

### State machine (`features/verification/services/state-machine.ts`)

All 9 allowed transitions, enforced strictly:

```
DRAFT           → PENDING_REVIEW      (SYSTEM — automatic on submission)
PENDING_REVIEW  → APPROVED            (ADMIN, SUPER)
PENDING_REVIEW  → NEEDS_INFO          (ADMIN, SUPER)
PENDING_REVIEW  → REJECTED            (ADMIN, SUPER)
NEEDS_INFO      → PENDING_REVIEW      (SYSTEM — on submitter response)
NEEDS_INFO      → REJECTED            (ADMIN, SUPER — stale/no response)
APPROVED        → NEEDS_INFO          (ADMIN, SUPER — post-approval quality issue)
APPROVED        → REJECTED            (ADMIN, SUPER — mandatory reason required)
REJECTED        → PENDING_REVIEW      (ADMIN, SUPER — appeal/resubmission)
```

All other transitions are forbidden. The state machine returns `{ allowed: false, reason }` and no DB write occurs.

### Verification service (`features/verification/services/verification.service.ts`)

The sole module authorised to write `Restaurant.verificationStatus`. Uses `dbForVerification` (the unguarded Prisma client). All transitions are fully transactional:
1. `Restaurant.update` (verificationStatus, confidenceScore)
2. `VerificationRecord.update` (currentStatus, confidenceScore, scoreBreakdown, optional fields)
3. `VerificationEvent.create` (immutable audit entry)

Operations: `approve()`, `reject()`, `requestInfo()`, `processSubmitterResponse()`, `assignAdmin()`.

### Confidence scoring (`features/verification/services/confidence-score.service.ts`)

Seven binary signals, weights summing to 1.000:

| Signal | Field | Weight |
|---|---|---|
| S1 — Valid phone | `Restaurant.phone` (Nigerian regex) | 0.20 |
| S2 — Verified photo exists | `RestaurantPhoto.isVerified = true` (count ≥ 1) | 0.15 |
| S3 — Three or more dishes | `RestaurantDish.deletedAt IS NULL` (count ≥ 3) | 0.15 |
| S4 — Admin approved | `verificationStatus = APPROVED` | 0.25 |
| S5 — Description ≥ 50 chars | `Restaurant.description.length ≥ 50` | 0.10 |
| S6 — Street-level address ≥ 20 chars | `Restaurant.address.length ≥ 20` | 0.10 |
| S7 — Contact channel present | `website` OR `email` non-null | 0.05 |

REJECTED restaurants are always hard-zeroed to `0.000`. Score is stored in both `Restaurant.confidenceScore` and `VerificationRecord.confidenceScore` (both updated in the same transaction — they must never diverge).

**Approval gate:** Before the APPROVED transition is written, `evaluateApprovalThreshold()` simulates the score with `verificationStatus = APPROVED`. If the result is below 0.40, the service throws `ValidationError` and no write occurs.

### Response token service (`features/verification/services/response-token.service.ts`)

NEEDS_INFO response flow:
- Token: HS256 JWT signed with `NEXTAUTH_SECRET`, 14-day expiry
- Payload: `{ restaurantId, verificationRecordId, exp }` — no PII
- Replay prevention: SHA-256 token hash stored in `UsedVerificationToken` after first use
- Second use: `GoneError` → API returns `410`

### Notification service (`features/verification/services/notification.service.ts`)

Four email types via Resend + React Email:
1. **Intake confirmation** — sent on successful submission
2. **Needs-info** — contains admin feedback text and response link (token)
3. **Approval** — sent when status moves to APPROVED
4. **Rejection** — sent with sanitised reason (never exposes internal admin notes)

All sends are best-effort: failures are logged but do not roll back the transaction.

---

## 11. Intelligence Platform Summary

The intelligence platform governs admin-driven enrichment of restaurant, dish, and photo data — the process that transforms a basic listing into a structured food intelligence asset.

**Service:** `features/verification/services/intelligence.service.ts`  
**Exported via:** `features/verification/index.ts`  
**DB client used:** `db` (standard client — never touches `verificationStatus`)

### Operations

| Method | Action | Score recalculates? |
|---|---|---|
| `verifyDish()` | Sets `RestaurantDish.verifiedAt`; optional nameAsServed, availabilityStatus, price | Yes (FIELD_UPDATED trigger) |
| `verifyPhoto()` | Sets `RestaurantPhoto.isVerified` / `isPrimary` | Yes — only when `isVerified` changes |
| `updateAvailability()` | Updates `RestaurantDish.availabilityStatus` | No |
| `updatePricing()` | Updates `RestaurantDish.price` | No |
| `recalculateRestaurantIntelligence()` | Updates allowed restaurant fields (description, phone, email, website, priceRange, area) | Yes (FIELD_UPDATED trigger) |
| `overrideScore()` | SUPER-only manual score override | Yes (writes OverrideBreakdown, no standard signal evaluation) |

### Forbidden fields

`recalculateRestaurantIntelligence()` and the admin intelligence API are enforced by the `IntelligenceUpdateSchema` to exclude: `name`, `slug`, `city`, `state`, `verificationStatus`. These fields cannot be changed via the intelligence layer under any circumstances.

### Score recalculation pattern

All score-triggering intelligence operations execute in a single transaction:
1. Update the triggering record (RestaurantDish or RestaurantPhoto or Restaurant fields)
2. `restaurant.update` (new confidenceScore)
3. `verificationRecord.update` (new confidenceScore, new scoreBreakdown JSON)

---

## 12. Admin Platform Summary

The admin platform is the internal tooling through which admins review, approve, and enrich restaurant submissions.

**Service:** `features/admin/services/queue.service.ts` — `QueueService`  
**Schemas:** `features/admin/schemas/queue.schema.ts`, `features/admin/schemas/intelligence.schema.ts`

### QueueService operations

- `getQueue(params, adminId)` — paginated, filtered list of VerificationRecords. Filters: status (default PENDING_REVIEW), city, assignedTo (me / UUID / unassigned / absent), sort (oldest/newest). Returns QueueRecord shape with `hasInternalNotes` boolean.
- `getDetail(restaurantId)` — full restaurant with all relations for the review screen (dishes, photos, verificationRecord, verificationEvents). Includes internal notes (admin-only field).
- `getHistory(restaurantId)` — ordered `VerificationEvent` array, ascending by createdAt.

### Assignment model

Assignment (`VerificationRecord.assignedTo`) is a soft advisory signal — it shows other admins who is reviewing, but does not lock the record. Assignment is set explicitly via `POST /assign`, not as a side effect of `GET /detail` (HTTP GET must remain idempotent). Assignment is cleared on every state transition.

### Role enforcement pattern (implemented in every admin route)

```typescript
const session = await getServerSession(authOptions)
if (!session) return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
requireRole(session, [UserRole.ADMIN, UserRole.SUPER])
```

Both checks are present in every admin route handler. Middleware is a first gate; the route handler is the authoritative gate. Removing either is a security violation.

---

## 13. Outstanding Phases

The following remain to be built, in strict sequence per the implementation law.

### ~~Step 13 — Submitter Response API~~ (COMPLETE)

**File:** `app/api/v1/verification/respond/[token]/route.ts` ✅ tested  
**Completed:** 2026-06-04 (pre-restart, untracked in git at audit time)

### Steps 15–19 — UI Layer

All UI is currently unbuilt. The service and API layer is complete enough to support building all UI components.

| Step | Deliverable | Route |
|---|---|---|
| 15 | Restaurant intake form (multi-step wizard) | `app/(public)/submit/page.tsx` |
| 16 | Submitter response form | `app/(public)/verify/respond/page.tsx` |
| 17 | Admin verification queue | `app/admin/queue/page.tsx` |
| 18 | Admin review screen | `app/admin/restaurants/[id]/review/page.tsx` |
| 19 | Admin intelligence edit screen | `app/admin/restaurants/[id]/intelligence/page.tsx` |

### UI components required (per track-02 §10.3)

| Component | Location | Used By |
|---|---|---|
| `VerificationStatusBadge` | `features/verification/components/` | Queue, review screen |
| `ConfidenceScoreWidget` | `features/verification/components/` | Review screen, intelligence screen |
| `DishVerifyCard` | `features/verification/components/` | Review screen, intelligence screen |
| `PhotoVerifyGrid` | `features/verification/components/` | Review screen, intelligence screen |
| `VerificationEventTimeline` | `features/verification/components/` | Review screen |
| `IntakeFormContainer` | `features/restaurants/components/IntakeForm/` | `/submit` |
| `DishTypeahead` | `features/restaurants/components/` | Step 2 of intake form |

### Post-Track-2 tracks (not yet designed or started)

| Track | Systems |
|---|---|
| Track 3 | Restaurant Listing System — public-facing restaurant profiles |
| Track 4 | Search System — full-text dish search, alias matching, geo-aware ranking |
| Track 5 | User System — accounts, saved dishes, search history |
| Track 6 | Admin Platform — analytics, taxonomy management, platform health metrics |

No implementation documents exist yet for Tracks 3–6. Each track document must be created and approved before any implementation begins (per architecture governance law).

---

## 14. Technical Debt

The following known gaps and accepted limitations exist. None are blockers for Track 2 completion.

| Item | Description | Resolution Path |
|---|---|---|
| `findUnique` soft-delete gap | Prisma's extension API does not support `findUnique` interception. Soft-delete filter only applies to `findMany` and `findFirst`. | Services must use `findFirst` (with soft-delete) instead of `findUnique` for `Restaurant`, `RestaurantDish`, and `User`. Documented in `db.ts`. |
| `$executeRaw` / `$queryRaw` bypass | Raw SQL queries bypass all Prisma extensions. The verificationStatus write guard and soft-delete filter do not apply. | All raw SQL must be reviewed for correctness. Currently only used in `duplicate-check.service.ts` for the fuzzy match query (pg_trgm), which is read-only. |
| `upsert` not guarded | The verificationStatus write guard does not intercept `upsert`. | `upsert` is not used on `Restaurant` in this architecture. Documented as a known gap. |
| NEEDS_INFO timeout not automated | Submissions in NEEDS_INFO > 30 days are not automatically rejected. | Phase 1: manual admin action via "stale items" filter. Phase 2: scheduled cron job. |
| React Email templates — standalone files not yet created | `notification.service.ts` dispatches emails, but the template component files in `features/verification/emails/` have not been created as separate files. | Must be created before the notification flow can be end-to-end tested against Resend in a real environment. Currently tested via mocks. |
| ~~No Next.js middleware for admin route protection~~ | **RESOLVED 2026-06-04.** `middleware.ts` implemented at project root. Redirects unauthenticated → `/login?callbackUrl=…`, wrong-role → `/`. Layer 2 route handler checks remain in place. | — |
| No `restaurant-listing-track.md` | Track 3 has no architecture document. | Create before beginning Track 3 implementation. |
| No `user-accounts-track.md` | Track 5 has no architecture document. | Create before beginning Track 5 implementation. |

---

## 15. Architectural Decisions That Must Never Be Violated

These are hard rules. They are not stylistic preferences. Violating them introduces security vulnerabilities, data integrity failures, or trust-corrupting bugs.

### AD-1: `verificationStatus` ownership

`VerificationService` is the sole module authorised to write `Restaurant.verificationStatus` and `VerificationRecord.currentStatus`. All other code uses `db`, which has a Prisma extension that throws immediately if `verificationStatus` is present in an update payload. `VerificationService` uses `dbForVerification` (the unguarded client) and must never be imported or re-exported outside `features/verification/`.

### AD-2: All state transitions are transactional

Every call to approve/reject/requestInfo/processSubmitterResponse executes all three writes (`restaurant.update`, `verificationRecord.update`, `verificationEvent.create`) in a single Prisma transaction. Partial state is never committed. A VerificationEvent without a corresponding status update, or a status update without an audit event, is a data integrity violation.

### AD-3: VerificationEvent is append-only

The `VerificationEvent` table must never be updated or deleted. The Prisma extension in `db.ts` does not currently guard against this (the guard is only on `verificationStatus`). This is enforced architecturally: no service other than VerificationService creates VerificationEvents, and VerificationService only ever calls `verificationEvent.create`. Any `verificationEvent.update` or `verificationEvent.delete` call is a security violation.

### AD-4: Admin routes have two security gates

Every admin API route must have both:
1. Next.js middleware at the `/admin/*` path level (session check)
2. `getServerSession()` + `requireRole()` in the route handler itself

Removing either gate is a security violation per `security-standards.md §3.4`.

### AD-5: `internalNotes` is never returned in non-admin responses

`VerificationRecord.internalNotes` contains internal admin notes that must never reach a submitter or public consumer. All queries that include `VerificationRecord` in a non-admin context must explicitly select or omit this field.

### AD-6: Score and status must never diverge

`Restaurant.confidenceScore` and `VerificationRecord.confidenceScore` must always be identical. Both are updated in the same transaction. Any divergence is a data integrity violation. If they are found to differ, both must be set to the value calculated from scratch using the current restaurant data.

### AD-7: The 0.40 approval threshold is non-negotiable

No restaurant may enter `APPROVED` status with a confidence score below 0.40. This is enforced by `evaluateApprovalThreshold()` in `confidence-score.service.ts`, called before every approval transaction. The SUPER role can override a score post-approval via `overrideScore()`, but cannot bypass the threshold at the time of approval.

### AD-8: No speculative infrastructure

Phase 1 uses PostgreSQL for rate limiting (not Redis), manual admin action for NEEDS_INFO timeouts (not cron), and structured Vercel logs for intelligence audit events (not a database table). These are intentional Phase 1 decisions. Do not add Redis, queue workers, or event buses until a specific measured bottleneck requires them.

### AD-9: Schema changes require architecture document updates

No field, model, or enum may be added to `prisma/schema.prisma` without a corresponding update to the governing architecture document (`database-track.md` or the relevant track document). The schema comment on line 1 of `schema.prisma` states this explicitly.

### AD-10: Feature modules use only their own DB client

Feature modules access the database through their own `index.ts` exported types and the shared `lib/db.ts` client. `dbForVerification` is an exception: it is exclusively for `features/verification/services/verification.service.ts` and must never be imported anywhere else.

---

## 16. Current Milestone

**Milestone:** Track 3, Step 6 — Consumer UI Components — Complete  
**Boundary:** All three public listing API routes built and tested. All 6 consumer UI components implemented (TrustBadge, RestaurantCard, DishCard, PhotoGallery, PhotoLightbox, RestaurantContactSection). Next: Step 7 — consumer pages.  
**Test evidence:** 927 tests · 35 test files · 0 failures (as of 2026-06-05)

The admin verification queue (`/admin/queue`) is fully operational: filter by status/sort/city/assignment, paginated results, live TanStack Query data, loading skeletons, empty states per DS §15.2, and URL-serialized filter state for shareable links.

---

## 17. Product Experience & Design Vision

This section is architecture-level guidance. It governs all UI implementation decisions with the same authority as the engineering laws in §15. It is not optional design notes.

### Brand Philosophy

Chow Here is not a restaurant directory. Chow Here is a trusted dish-first food discovery platform.

The UI must communicate the following feelings at every surface:

- **Trust** — verified data, honest signals, nothing unearned
- **Warmth** — Nigerian food culture is celebratory; the product must reflect that
- **Confidence** — the platform knows what it is; no hedging, no generic placeholders
- **Premium simplicity** — less but better, always

### Product Standard

The UI must be S-tier. There is no acceptable bar below this.

**Avoid:**
- Generic SaaS dashboard aesthetics
- Bootstrap-looking interfaces
- Template marketplace patterns
- Filler animations and decorative noise

**Target reference points:**
- Apple — simplicity and hierarchy
- Airbnb — polish and food/place photography treatment
- Google Maps — usability and location clarity
- Modern mobile-first apps — thumb-zone navigation, fast interaction, clear affordances

### Consumer Experience

The primary product surface. This is what every design decision is ultimately in service of.

**Goals:**
- Dish-first discovery — search starts with a dish name, not a restaurant name
- Beautiful food presentation — photography is a first-class UI element, not decoration
- Fast search — results appear instantly; latency is a trust signal
- Clear trust indicators — users must be able to see why a listing is verified without reading documentation
- Location-aware recommendations — proximity surfaces relevance
- Navigation-first experience — the product answers "where do I go?" not just "what exists?"

### Restaurant Submitter Experience

The pipeline for adding a restaurant to the platform. The UX must reduce friction and communicate integrity.

**Goals:**
- Submission transparency — submitters know exactly where their submission is in the process
- Verification progress tracking — the status machine is visible, not opaque
- Clear status communication — every state (DRAFT, PENDING_REVIEW, NEEDS_INFO, APPROVED, REJECTED) has a human-readable explanation
- Trust-building interactions — the experience must make submitters feel their contribution matters

### Admin Experience

An internal operational tool used by a small team making consequential decisions. Optimise for speed and clarity, not visual impact.

**Goals:**
- Operational efficiency — every workflow step requires minimal clicks
- Information density — admins need to see everything relevant without scrolling or drilling
- Fast review workflows — the default queue view should surface what needs action without filtering
- Minimal clicks to decision — Approve / Reject / Needs-Info should be reachable in two actions from the queue
- Clear audit visibility — the event timeline is always visible on the review screen; nothing is hidden

### Design System Requirement

**Before any UI implementation begins, the following document must be created:**

`docs/design/chow-here-design-system-v1.md`

No UI file (`*.tsx` page or component) may be committed until this document exists and has been reviewed. This is the same class of requirement as the architecture document prerequisite in §15 AD-9.

The design system document must define:

| Area | Required Content |
|---|---|
| Colors | Brand palette, semantic tokens, dark mode alternates |
| Typography | Type scale, font choices, heading/body/label hierarchy |
| Spacing | Base unit, spacing scale, layout grid |
| Component library | Buttons, inputs, cards, badges, modals, tables — spec before implementation |
| Motion system | Duration scale, easing curves, interaction choreography |
| Loading states | Skeleton patterns, spinner usage, progressive loading |
| Empty states | Per-context empty state messaging and illustration style |
| Error states | Inline errors, toast notifications, full-page error handling |
| Dark mode strategy | Full dark mode or admin-only; decision must be explicit |
| Accessibility standards | WCAG AA minimum, keyboard navigation, focus management, ARIA patterns |
| Mobile-first standards | Breakpoints, touch targets, thumb-zone mapping |

### Animation Standards

Every animation in the product must satisfy all four criteria:

- **Fast** — no animation longer than 300ms for interactions; page transitions max 500ms
- **Subtle** — motion should be noticed only if absent, not while present
- **Purposeful** — every animation communicates state change or guides attention; no decorative motion
- **Premium** — use ease-out for entrances, ease-in for exits, never linear

**Prohibited:** bouncing, spinning loaders on fast operations, parallax effects, scroll-triggered flourishes.

### Future Navigation Vision

The long-term user journey beyond Phase 1. This vision must be preserved in future architecture and UI planning so that Phase 1 decisions do not create dead ends.

```
Dish Search
  → Restaurant Match (verified results, ranked by relevance)
  → Distance Ranking (geo-aware, proximity sorted)
  → Route Preview (journey overview before committing)
  → Turn-by-Turn Navigation (in-product, not handing off to a third party)
  → Real-Time Tracking (live position during journey)
  → Arrival Confirmation (closes the discovery loop)
```

Phase 1 does not implement navigation. Phase 1 must not make decisions that close off this path — for example, omitting location data from the schema, or building a UI structure that cannot accommodate a map layer.

---

## 18. Recommended Next Phase

**Recommended next step:** Step 18 — Admin Review Screen

**File to create:**
- `app/admin/restaurants/[id]/review/page.tsx` — full restaurant detail for admin decision

The review screen is the most data-dense admin page. It displays: restaurant fields, dishes, photos (photo grid), confidence score widget (all 7 signals), verification event timeline, and the three-action decision bar (Approve / Request Info / Reject) per DS §11.4.

**Sequence for Steps 17–19:**

1. Step 17 — Admin queue UI (`/admin/queue`) — primary daily workflow
2. Step 18 — Admin review screen (`/admin/restaurants/[id]/review`) — most data-dense page
3. Step 19 — Admin intelligence screen (`/admin/restaurants/[id]/intelligence`) — enrichment workflow

All three steps consume APIs that are already built and tested.

**After Track 2 complete:** Define Track 3 architecture document (`restaurant-listing-track.md`) before writing any code for the public restaurant listing system.

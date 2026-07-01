# Chow Here — Track 5: User Accounts and Saved Dishes

**Status:** IMPLEMENTED — 2026-07-01
**Version:** 1.1
**Date:** 2026-07-01
**Governed By:** master-architecture.md · security-standards.md · data-governance.md · chow-here-design-system-v1.md
**Depends On:** Track 4 (Search and Discovery) — complete
**Next Track:** none defined yet

---

## 0. PURPOSE OF THIS DOCUMENT

This document is the authoritative architecture and product specification for Chow Here's public User Account System (Track 5). It closes the gap Track 4 deliberately left open: real accounts, real sign-up, and a real `/api/v1/users/saved-dishes` API behind the save button that has existed in the UI since Track 4.

Track 4 already made every product and API-contract decision this track needs (§7.2–§7.5, §8.1, §14.4, §18.8 of `track-04-search-discovery.md`). Track 5 does not re-decide those things — it implements them and defines the two pieces Track 4 explicitly deferred:

1. Public account creation and sign-in (Track 4 assumed an authenticated session exists; it never said how one is created).
2. The `/dashboard/saved` page and account-facing UI shell.

**Non-goal of this document:** re-litigating anything Track 4 already specified. Where this doc repeats a Track 4 decision, it cites the source section rather than restating rationale.

---

## 1. CURRENT STATE (as audited 2026-07-01)

What already exists and must not be redesigned:

- **Schema** — `User`, `SavedDish`, `UserSearchHistory` models are complete in `prisma/schema.prisma` (lines 64–83, 292–305, 311–323). No migration needed for Track 5's core scope.
- **Auth core** — `src/lib/auth.ts` (`authOptions`, `hashPassword`, `verifyPassword`, `authorizeUser`, `requireRole`) is role-agnostic. It already authenticates any `User` row regardless of role; it is not admin-specific.
- **Admin login page** (`app/login/page.tsx`) is admin-only by convention, not by mechanism: it hardcodes `callbackUrl` validation to `/admin/*` paths. It must not be repurposed for public sign-in — Track 5 needs its own route (§4).
- **Middleware** (`middleware.ts`) only guards `/admin/*`. It does not need changes for Track 5 — user-facing routes are protected at the route-handler and page level, per security-standards.md §3.3 Rule 1.
- **`useSavedDish` hook** (`features/search/hooks/useSavedDish.ts`) is an explicit stub per its own header comment: no persistence, resets on reload, shows "Sign in to save dishes" for guests. This is the file Track 5 replaces.
- **Rate limiting** (`lib/rate-limit.ts`, `checkRateLimit(key, limit, windowMs)`) is ready to reuse — no new infrastructure needed.

**What does not exist:** any public-facing registration flow, any public sign-in page, and any of the three save-dish endpoints Track 4 §7.4 already specified.

---

## 2. PRODUCT OBJECTIVES

| ID | Objective | Rationale |
|---|---|---|
| BO-1 | Let a user create an account and have every save persist across devices and sessions | Closes Track 4's Loop 2 (Saved Dish Access) — currently the save button lies to the user |
| BO-2 | Implement the exact API contract Track 4 §7.4 already promised the frontend | The `useSavedDish` hook and `SearchRestaurantCard` UI were built against this contract already — changing it now breaks working UI |
| BO-3 | Build `/dashboard/saved` as the return-visit home for a signed-in user | Track 4 §7.3 explicitly defers this page here |
| BO-4 | Surface `UserSearchHistory` in the search bar's idle state | Track 4 §8.1 writes this data; nothing reads it yet |

### 2.1 Explicit Non-Objectives

- Social login (Google/Apple/etc.) — email/password only, matching the existing `CredentialsProvider` pattern (security-standards.md §1)
- Email verification enforcement at signup — `User.emailVerified` field exists but Phase 1 does not block login on it (see §8.2 for why)
- Password reset flow — out of scope until a transactional email need exists beyond what Resend already sends for verification (defer to a future track; do not build ad hoc)
- Public user profile pages, avatars beyond the existing `avatarUrl` field, or any social/follow feature (forbidden by master-architecture.md §1.2 — not a social food network)
- Restaurant-review or rating features attached to accounts (same reason)

---

## 3. DATA MODEL

No schema changes. `User`, `SavedDish`, and `UserSearchHistory` are used as-is (see §1). This is a service/API/UI track only.

---

## 4. AUTHENTICATION SURFACE

### 4.1 New Public Routes

| Route | Purpose |
|---|---|
| `/signup` | Public account creation |
| `/signin` | Public sign-in |

**Decision (2026-07-01):** `/login` stays admin-only, unchanged, per its existing comments and tests. Public sign-in lives at a new route, `/signin`, entirely separate from the admin auth flow. This was an open question in v1.0 of this doc — resolved before implementation began.

### 4.2 Registration

```
POST /api/v1/users/register
Auth: none (public)
Body: { email: string, password: string, displayName?: string }
Response 201: { id: string }
Response 409: email already registered
Response 422: validation failure (password policy, malformed email)
Rate limit: 5/IP/hour, key "register:{ip}" — mirrors intake's existing pattern (security-standards.md's established rate-limit convention; reuses checkRateLimit from lib/rate-limit.ts)
```

- Password policy: reuse `hashPassword()` (bcrypt cost 12, already in `src/lib/auth.ts`) — no new hashing code.
- New users are created with `role: USER`, `isActive: true`, `emailVerified: false`.
- No admin approval step — this is a self-service consumer signup, unlike restaurant intake.

### 4.3 Sign-in

Uses the existing `CredentialsProvider` / `authorizeUser()` unchanged (§1) — no new backend auth logic. Only a new page is needed per §4.1.

### 4.4 Session and Ownership Rules

Both already fully specified — implement, do not redesign:
- Session strategy: JWT, 24-hour maxAge (security-standards.md §2, line 45)
- Ownership check on every mutation: `session.user.id === resource.userId`, never trust a client-supplied user id (security-standards.md §3.3, lines 179–189)

---

## 5. SAVED DISHES API

This is Track 4 §7.4, implemented verbatim:

```
POST /api/v1/users/saved-dishes
Auth: USER, ADMIN, SUPER
Body: { restaurantDishId: string }
Response 201: { id: string }
Response 409: already saved (client treats as success — idempotent per Track 4 §7.3)

DELETE /api/v1/users/saved-dishes/:savedDishId
Auth: USER, ADMIN, SUPER
Response 204: no content
Ownership: 403 if savedDish.userId !== session.user.id

GET /api/v1/users/saved-dishes
Auth: USER, ADMIN, SUPER
Query: page, limit (max 20 — matches the site-wide search page-size cap), city (optional)
Response 200: paginated list, each entry joined with RestaurantDish → Restaurant + DishTaxonomy for display context
```

### 5.1 Service Layer

`features/accounts/services/saved-dish.service.ts` (new):
- `saveDish(userId, restaurantDishId)` — upsert-safe (unique constraint `[userId, restaurantDishId]` already exists on `SavedDish`; catch the Prisma P2002 conflict and return the existing row rather than erroring, to satisfy the 409-as-idempotent-success contract)
- `unsaveDish(userId, savedDishId)` — ownership check before delete
- `listSavedDishes(userId, { page, limit, city })`

### 5.2 Zustand Store — Replacing the Stub

`features/search/hooks/useSavedDish.ts` is rewritten to:
1. On authenticated session start, populate `savedDishIds: Set<string>` from `GET /api/v1/users/saved-dishes` (IDs only — Track 4 §7.5 already specifies this as "a single lightweight request").
2. Call the real `POST`/`DELETE` endpoints on toggle, keeping the existing optimistic-update / revert-on-error behavior already built into the hook and `SearchRestaurantCard`.
3. No UI changes to `SearchRestaurantCard` are required — Track 4 built it against this exact contract.

---

## 6. `/dashboard/saved` PAGE

Per Track 4 §7.3 ("Track 5 builds the `/dashboard/saved` listing page") and design-system-v1.md conventions already established for restaurant listings.

**UI approach:** reuse existing components, do not invent new ones.
- List rendering reuses the `RestaurantCard`/`SearchRestaurantCard` pattern (Track 3/4) with dish context (`nameAsServed`, `restaurantDish` price) already part of that component's props.
- Empty state copy follows the same honest, specific tone Track 4 §18.7 established for zero-result search states — e.g. "You haven't saved any dishes yet. Search for a dish and tap the bookmark to save it here."
- Pagination: same `page`/`limit` pattern as `GET /api/v1/restaurants`, cap 20.

**No new visual design decisions in this doc.** If the saved-dishes page needs anything beyond an existing card/list pattern (e.g. a distinct page header treatment, an account nav shell), that is a design-system-v1.md gap to raise before building it — per the standing UI Design Fidelity Rule, do not invent it here.

---

## 7. SEARCH HISTORY SURFACING

Per Track 4 §8.1 — `UserSearchHistory` is already written on every authenticated search. Track 5's only job is to read it:

```
GET /api/v1/users/search-history
Auth: USER, ADMIN, SUPER
Response 200: last 10 entries, most recent first, deduplicated by query text
```

Consumed by the search bar's idle-state dropdown (already built in Track 4 for the anonymous/no-history case) — this is a data source addition, not a new UI surface.

---

## 8. EDGE CASES AND OPEN DECISIONS

### 8.1 `/login` route conflict — RESOLVED 2026-07-01

See §4.1. `/login` stays admin-only; public sign-in is `/signin`.

### 8.2 Why `emailVerified` doesn't block login in Phase 1

Chow Here has no transactional email flow triggering verification yet (Resend is only wired for admin/verification-workflow email per `track-02-verification-intelligence.md`). Requiring verification before login with no way to verify would lock every new user out. `emailVerified` is tracked for future use; Phase 1 treats all registered accounts as usable immediately. Revisit only if abuse becomes a real problem — do not build verification-gating speculatively (master-architecture.md's "no speculative infrastructure" law).

### 8.3 Save race on rapid double-tap

`SavedDish`'s existing `@@unique([userId, restaurantDishId])` constraint (already in schema) makes double-saves safe at the database level regardless of client timing — this is why §5.1 catches P2002 instead of pre-checking existence.

### 8.4 Deleted / deactivated accounts and saved dishes

data-governance.md §187 already states: `SavedDish` — hard delete on user request, no retention value. Account deletion is out of scope for Track 5 (no UI trigger for it yet); this doc notes it only so a future "delete my account" feature does not need new data-governance research — the policy already exists.

---

## 9. IMPLEMENTATION SEQUENCE

Schema → Service → API → UI, per master-architecture.md's implementation sequence law. No schema step — schema is already complete (§1, §3).

1. Resolve the `/login` routing decision (§8.1) — blocks Step 5.
2. `features/accounts/services/saved-dish.service.ts` — save/unsave/list, with unit tests for the ownership and idempotent-conflict rules (§5.1, §8.3).
3. `POST /api/v1/users/register` — registration service + route + rate limit (§4.2).
4. `POST/DELETE/GET /api/v1/users/saved-dishes` and `GET /api/v1/users/search-history` routes, wired to the services above.
5. `/signup` page and public sign-in page (path per §8.1 resolution).
6. Rewire `features/search/hooks/useSavedDish.ts` to the real API (§5.2) — no changes to `SearchRestaurantCard`.
7. `/dashboard/saved` page (§6), reusing existing card components.
8. Search bar idle-state: wire `GET /api/v1/users/search-history` into the existing dropdown UI.

---

## 10. IMPLEMENTATION NOTES (2026-07-01)

All 8 steps above are implemented. Deviations and additions worth recording:

- **`GET /api/v1/users/saved-dishes?idsOnly=true`** returns `{ entries: [{ restaurantDishId, savedDishId }] }`, not bare ids. The Zustand store needs `SavedDish.id` to call DELETE for dishes saved in a *previous* session — an id-only list would have made unsave silently no-op for anything not saved in the current browser tab. See `features/accounts/stores/saved-dishes.store.ts`.
- **Bottom nav "Saved" tab added** (`ConsumerBottomNav.tsx`) — the design system (§10.5, §15.2) and the pre-existing code comments already called for this; no new visual decision was made. **"Profile" tab intentionally NOT added** — no profile page exists or is in this track's scope; adding the nav item without a destination would be inventing scope.
- **Top nav right-side slot** (`ConsumerTopNav.tsx`) — design-system-v1.md §10.5 specifies "Login / Profile avatar" here. Implemented as a plain text link: "Sign in" (unauthenticated) → `/signin`, "Saved" (authenticated) → `/dashboard/saved`. No avatar — there is no avatar UI anywhere yet and inventing one wasn't in scope.
- `/dashboard/saved` reuses the design system's exact empty-state copy (§15.2) but its restaurant card is a new, smaller component inline in the page rather than literally reusing `SearchRestaurantCard` — the saved-dish list response shape doesn't carry `priceRange`, `confidenceScoreBand`, or `dishesServed`, so the full card couldn't be reused without adding fields the API contract (§5, Track 4 §7.4) never specified.

---

## Document Relationships

```
master-architecture.md              ← Governing law
security-standards.md               ← Auth, session, ownership rules (already implemented, reused)
data-governance.md                  ← SavedDish deletion policy (already specified, reused)
    │
    └── track-04-search-discovery.md   ← Defines the SavedDish API contract (§7.4) and UI (SearchRestaurantCard)
            │
            └── track-05-user-accounts.md ← THIS DOCUMENT — implements the contract, adds signup/sign-in
```

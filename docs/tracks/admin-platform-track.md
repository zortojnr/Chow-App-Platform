# Chow Here — Admin Platform Track

**Status:** AUTHORITATIVE BLUEPRINT  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Documents:** master-architecture.md, backend-standards.md, security-standards.md, frontend-standards.md

---

## 0. PURPOSE

This track defines the complete design of the Admin Platform — the internal tool through which admins review restaurant submissions, manage verified listings, curate the dish taxonomy, and monitor platform health.

The admin platform is not a public product. It is a trusted internal tool. Its primary user is a small team (1–5 people) making consequential decisions about data trust. It is optimized for **clarity, auditability, and speed of review** — not for visual design or feature breadth.

**This is a blueprint, not implementation code.**

---

## 1. SYSTEM RESPONSIBILITIES

The Admin Platform owns exactly these responsibilities:

| Responsibility | Description |
|---|---|
| Verification queue | Display and manage the review queue for PENDING_REVIEW submissions |
| Submission review | Detailed view of a submission with all required admin actions |
| Dish taxonomy management | Create, edit, deactivate canonical dish entries |
| Approved restaurant management | View, edit, and moderate live listings |
| Search analytics | Read-only view of search query trends from SearchLog |
| Platform health metrics | Submission counts, queue depth, approval rates |
| Admin user management | SUPER admins can create/deactivate ADMIN accounts |

It does **not** own:
- Verification business logic (owned by Verification System)
- Search execution (owned by Search System)
- Public restaurant pages (owned by Restaurant Listing System)
- Any user-facing UI components

---

## 2. ACCESS MODEL

### 2.1 Admin Roles

There are two admin roles:

| Role | Capabilities |
|---|---|
| `ADMIN` | Review queue, approve/reject/request-info, manage dishes, view analytics |
| `SUPER` | All ADMIN capabilities + create/deactivate admin users + permanently delete listings |

No public user can access any admin route, regardless of URL knowledge. All admin routes are route-guarded at both middleware and handler level.

### 2.2 Route Protection

Admin routes live under `/admin/*` and `/api/v1/admin/*`.

**Middleware:** Next.js middleware checks session role and redirects non-admins to `/` on any `/admin/*` route.

**API handlers:** Every admin API route performs an explicit role check as the first operation. Middleware is not the only guard.

```typescript
// Pattern in every admin API route
const session = await requireSession(request)
requireRole(session, ['ADMIN', 'SUPER'])
// ... handler logic
```

### 2.3 Admin Authentication

Admins authenticate through the same NextAuth session system as regular users. They do not have a separate auth system. Role is stored in the `User.role` field and included in the session JWT.

**No public registration path for admin accounts.** Admin accounts are created only by SUPER admin through the admin user management interface.

---

## 3. FEATURE OVERVIEW

### 3.1 Feature Map

```
/admin
  ├── /queue                  ← Verification queue (primary workflow)
  ├── /queue/:restaurantId    ← Individual submission review
  ├── /restaurants            ← All approved restaurants list
  ├── /restaurants/:id        ← Single restaurant management
  ├── /dishes                 ← Dish taxonomy management
  ├── /dishes/new             ← Create new dish
  ├── /dishes/:id             ← Edit dish
  ├── /analytics              ← Search trends and platform metrics
  └── /users                  ← Admin user management (SUPER only)
```

### 3.2 The Verification Queue (Primary Workflow)

The verification queue is the most important page in the admin platform. It is the daily workflow for every admin.

**Queue Display:**
```
Status tabs:  [PENDING_REVIEW | NEEDS_INFO | REJECTED | APPROVED]
Sort options: Newest first | Oldest first | Possible duplicates first
Filter:       By city, by admin assignee
```

**Queue Card (per submission):**
```
Restaurant name
City + State
Submitted: X days ago
Dishes: N dishes submitted
Photos: N photos
Possible duplicate: [badge if flagged]
Assigned to: [admin name or "Unassigned"]
[Review] button
```

### 3.3 Submission Review Page

The submission review page shows the full submission and provides action controls.

**Layout sections:**

```
Section 1: Restaurant Details
  - Name, address, city, state, area
  - Phone, email, website
  - Price range, cuisine types
  - Description
  - Submitter note (if provided)
  - Possible duplicate warning (if flagged)

Section 2: Dishes
  - Table: Dish name | As Served | Price | Availability | Status
  - Each dish links to its DishTaxonomy entry

Section 3: Photos
  - Photo grid with verify/reject per photo
  - Primary photo toggle

Section 4: Verification History
  - Chronological VerificationEvent log
  - Actor, timestamp, status change, reason

Section 5: Internal Notes
  - Admin-only notes field (NOT shown to submitter)

Action Bar (sticky footer):
  [Approve]  [Request Info]  [Reject]
  → Approve: confirm modal → calls /api/v1/admin/verification/:id/approve
  → Request Info: text input for feedback → calls /api/v1/admin/verification/:id/needs-info
  → Reject: text input for reason → calls /api/v1/admin/verification/:id/reject
```

### 3.4 Dish Taxonomy Management

Admins can create and manage canonical dish entries.

**Dish list view:**
- Table: Name | Category | Aliases | Active | Actions
- Filter by category
- Search by name
- Toggle active/inactive

**Dish create/edit form:**
```
canonicalName:   text input (required)
aliases:         tag input — add/remove aliases
category:        select from DishCategory enum
subcategory:     text input (optional)
description:     textarea (optional, max 500 chars)
isActive:        toggle
```

**Validation:** Enforced by `DishTaxonomySchema` in `features/dishes/schemas/`. The form uses the same Zod schema as the API.

### 3.5 Approved Restaurant Management

After a restaurant is approved, admins may need to update its listing.

**Editable fields post-approval:**
- Description
- Phone
- Website
- Price range
- Photos (mark as verified, remove)
- Dishes (add, remove, update availability)

**NOT editable by admin:**
- Restaurant name (would break SEO slug)
- Address (material change — requires new verification event)
- City/State

Changing the restaurant name or address requires creating a new `VerificationEvent` with `reason` explaining the change. This preserves the audit trail.

### 3.6 Analytics (Read-Only)

The analytics page provides lightweight signal, not a full analytics suite.

**Search Trends:**
```
Top 20 queries in last 7 days
Top 20 queries in last 30 days
Queries with 0 results (last 7 days)
Searches by city (last 30 days)
```

**Platform Health:**
```
Total approved restaurants
Total pending review
Total pending for > 7 days (attention required)
Total dishes in taxonomy
New submissions (last 7 days)
```

Data is pulled from `SearchLog`, `VerificationRecord`, `Restaurant`, and `DishTaxonomy` via direct DB queries. No separate analytics service.

### 3.7 Admin User Management (SUPER Only)

SUPER admins can manage the admin team.

**Admin user list:**
```
Table: Name | Email | Role | Last Login | Status | Actions
Actions: Deactivate | Promote to SUPER | Demote to ADMIN
```

**Create admin:**
```
Form: Email, display name, role (ADMIN or SUPER)
System: generates a temporary password and sends setup email
Admin must change password on first login
```

There is no self-service admin registration. Every admin account is explicitly provisioned.

---

## 4. API ENDPOINT DEFINITIONS

All admin API endpoints require ADMIN or SUPER role unless marked (SUPER only).

### 4.1 Verification Queue Endpoints

```
GET    /api/v1/admin/verification/queue
       → params: status, city, assignedTo, page, limit, sort

GET    /api/v1/admin/verification/:restaurantId
       → Full submission detail for review page

POST   /api/v1/admin/verification/:restaurantId/approve
POST   /api/v1/admin/verification/:restaurantId/reject
POST   /api/v1/admin/verification/:restaurantId/needs-info
POST   /api/v1/admin/verification/:restaurantId/assign
       → Body: { adminId: string | null }
```

### 4.2 Restaurant Management Endpoints

```
GET    /api/v1/admin/restaurants
       → params: status, city, page, limit

GET    /api/v1/admin/restaurants/:id
PATCH  /api/v1/admin/restaurants/:id
       → Partial update of editable fields

DELETE /api/v1/admin/restaurants/:id   (SUPER only — soft delete)

PATCH  /api/v1/admin/restaurants/:id/photos/:photoId
       → Body: { isVerified: boolean, isPrimary: boolean }

DELETE /api/v1/admin/restaurants/:id/photos/:photoId  (SUPER only)
```

### 4.3 Dish Taxonomy Endpoints

```
GET    /api/v1/admin/dishes
GET    /api/v1/admin/dishes/:id
POST   /api/v1/admin/dishes
PATCH  /api/v1/admin/dishes/:id
PATCH  /api/v1/admin/dishes/:id/deactivate
```

### 4.4 Analytics Endpoints

```
GET    /api/v1/admin/analytics/search-trends
       → params: period (7d | 30d)

GET    /api/v1/admin/analytics/platform-health
       → Returns counts: approved, pending, stale, dishes, weekly submissions
```

### 4.5 Admin User Management Endpoints (SUPER Only)

```
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PATCH  /api/v1/admin/users/:id
       → Allowed fields: role, isActive

DELETE /api/v1/admin/users/:id  (deactivate, not delete)
```

---

## 5. MODULE STRUCTURE

```
features/admin/
├── components/
│   ├── VerificationQueue/
│   │   ├── QueueTable.tsx
│   │   ├── QueueCard.tsx
│   │   └── QueueFilters.tsx
│   ├── SubmissionReview/
│   │   ├── ReviewLayout.tsx
│   │   ├── RestaurantDetails.tsx
│   │   ├── DishesTable.tsx
│   │   ├── PhotoGrid.tsx
│   │   ├── VerificationHistory.tsx
│   │   ├── InternalNotesEditor.tsx
│   │   └── ActionBar.tsx
│   ├── DishManager/
│   │   ├── DishTable.tsx
│   │   └── DishForm.tsx
│   ├── RestaurantManager/
│   │   ├── RestaurantTable.tsx
│   │   └── RestaurantEditForm.tsx
│   ├── Analytics/
│   │   ├── SearchTrends.tsx
│   │   └── PlatformHealth.tsx
│   └── AdminUsers/
│       ├── AdminUserTable.tsx
│       └── AdminUserForm.tsx
├── services/
│   ├── queue.service.ts        ← Queue queries and filters
│   ├── restaurant-admin.service.ts
│   ├── dish-admin.service.ts
│   ├── analytics.service.ts
│   └── admin-user.service.ts
├── hooks/
│   ├── useQueue.ts
│   ├── useSubmissionReview.ts
│   └── useAnalytics.ts
├── schemas/
│   ├── dish-form.schema.ts
│   └── restaurant-edit.schema.ts
└── types/
    └── admin.types.ts
```

---

## 6. UI/UX STANDARDS FOR ADMIN PLATFORM

### 6.1 Design Principles

The admin platform follows these principles — distinct from the public-facing product:

1. **Density over decoration** — Show maximum information with minimum chrome. Tables, not cards.
2. **Destructive actions require confirmation** — Any irreversible action shows a confirm modal.
3. **State is always visible** — Current verification status shown on every review screen at all times.
4. **Audit trail is always accessible** — Verification history is one scroll away on every review page.

### 6.2 Component Library

Admin UI uses the same shadcn/ui component library as the public platform. No custom component library. Tailwind classes only.

### 6.3 Admin Layout

```
[Sidebar Navigation]    [Main Content Area]
  Queue (badge count)     Page content
  Restaurants
  Dishes
  Analytics
  Users (SUPER only)
  ---
  [Logged in as: name]
  [Logout]
```

The sidebar shows a badge count on "Queue" reflecting the current `PENDING_REVIEW` count. This updates every 60 seconds via a background poll.

### 6.4 Confirmation Modals

All destructive or consequential actions use a confirmation modal:

```
Approve:      "Approve [Restaurant Name]? This will publish the listing."
Reject:       "Reject [Restaurant Name]? Enter the reason:" [text input]
Needs Info:   "Request more information? Enter your message:" [text input]
Delete:       "Permanently remove this listing? This cannot be undone." [Type name to confirm]
```

### 6.5 Loading and Error States

- Every data-fetching component shows a skeleton loader
- Every mutation shows an inline loading spinner on the action button
- Every error shows an inline error message (not a modal), with a retry option
- Network errors do not clear the form

---

## 7. SECURITY CONSIDERATIONS

### 7.1 Role Check Redundancy

Admin security is enforced at three layers:

```
Layer 1: Next.js middleware  → Redirects unauthenticated users from /admin/*
Layer 2: API route handlers  → requireRole() check at handler entry
Layer 3: Service layer       → Services accept actorRole parameter and validate
```

Three layers because middleware can be bypassed (e.g., direct API calls), and the service layer is callable from tests.

### 7.2 Admin Action Logging

Every admin action that changes data writes a `VerificationEvent` or is logged via the service layer. There is no "silent" admin mutation.

### 7.3 SUPER-Only Destructive Actions

Hard deletes and role changes require `SUPER` role. This is checked at both API and service layer. An `ADMIN` attempting a SUPER-only action receives `403 Forbidden`.

### 7.4 Admin Session Expiry

All sessions (admin and regular user) expire after **24 hours**, as defined in `security-standards.md §1.2`. NextAuth.js v4 uses a single `maxAge` setting across all roles:

```typescript
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60,  // 24 hours — applies to all roles
}
```

**Phase 1 position:** A per-role TTL (e.g., shorter admin sessions) is not implemented in Phase 1. NextAuth v4's JWT strategy requires custom session refresh middleware to achieve per-role TTL, which adds implementation complexity without a proportionate security benefit given the small admin team size. If the admin team grows significantly or a security incident warrants it, per-role TTL is a Phase 2 upgrade.

To reduce admin session risk in Phase 1: admin accounts are kept to the minimum necessary number, and SUPER accounts have a second-person confirmation for deactivation via the admin user management interface.

### 7.5 Admin API Rate Limiting

Admin API endpoints are rate-limited at 200 requests/minute per session. This prevents accidental tight-loop scripts from hammering the DB.

---

## 8. ADMIN NOTIFICATIONS

### 8.1 New Submission Alert

When a restaurant submission reaches `PENDING_REVIEW`, a notification is sent to all active admin accounts:

```
To:       All ADMIN + SUPER email addresses
Subject:  "New restaurant submission: [Restaurant Name]"
Body:     Restaurant name, city, submission time, direct review link
```

This is a "simple notify" in Phase 1 — a single email to a static list. No push notifications, no Slack integration, no real-time WebSocket updates.

### 8.2 Stale Queue Alert

If any submission remains in `PENDING_REVIEW` for more than 7 days, a daily digest email is sent to all admins listing the stale submissions. This is triggered manually by a SUPER admin action in Phase 1 ("Send stale queue digest").

---

## 9. IMPLEMENTATION SEQUENCE

### Step 1: Auth and Layout
1. Implement admin route middleware
2. Implement `requireRole()` utility
3. Build admin sidebar layout
4. Build admin login redirect flow

### Step 2: Verification Queue
1. Implement `GET /api/v1/admin/verification/queue` endpoint
2. Build `QueueTable` and `QueueCard` components
3. Wire badge count to sidebar
4. Add queue filters (status tabs, city, sort)

### Step 3: Submission Review
1. Implement `GET /api/v1/admin/verification/:restaurantId`
2. Build `ReviewLayout` with all sections
3. Build `ActionBar` with approve/reject/needs-info
4. Wire action endpoints (call Verification System track's service layer)
5. Build `VerificationHistory` timeline component

### Step 4: Dish Management
1. Implement dish CRUD admin endpoints
2. Build `DishTable` with edit/deactivate
3. Build `DishForm` for create/edit

### Step 5: Restaurant Management
1. Implement restaurant admin endpoints (PATCH, photo management)
2. Build `RestaurantTable` list view
3. Build `RestaurantEditForm`

### Step 6: Analytics
1. Implement analytics query endpoints
2. Build `SearchTrends` and `PlatformHealth` components
3. Wire to TanStack Query with 5-minute cache

### Step 7: Admin User Management
1. Implement admin user endpoints (SUPER only)
2. Build `AdminUserTable`
3. Build `AdminUserForm` with role assignment
4. Wire first-login setup flow

---

## 10. KNOWN RISKS AND EDGE CASES

| Risk | Mitigation |
|---|---|
| Two admins review same submission simultaneously | Assignment system shows who is reviewing; last-writer-wins for status change (acceptable Phase 1 limitation) |
| Admin accidentally approves wrong restaurant | Confirmation modal on approval; state transition is reversible (APPROVED → NEEDS_INFO) |
| SUPER admin account compromised | 24-hour session TTL; account can be deactivated immediately via DB or admin user management; a second SUPER account exists as backup |
| Dish deactivated while restaurants still reference it | Deactivation soft-disables dish; existing RestaurantDish records remain but are filtered from public search |
| Analytics queries are slow on large SearchLog | Analytics queries use indexed `createdAt`; results are cached at 5-minute TTL |
| Admin performs bulk action accidentally | No bulk actions in Phase 1 — every action is per-restaurant to enforce review discipline |
| New submission volume exceeds review capacity | Queue depth metric on analytics page provides early warning; process problem, not technical problem |

---

## 11. WHAT IS EXPLICITLY NOT IN THE ADMIN PLATFORM (PHASE 1)

| Feature | Reason |
|---|---|
| Bulk approve/reject | Discourages careful review; trust risk |
| Email templates editor | Phase 2 — static templates sufficient for launch |
| Automated verification scoring approval | Trust risk — human review is the moat |
| Advanced search analytics (keyword clustering, trends) | Phase 2 |
| Admin mobile app | Phase 2 |
| Webhook notifications to external systems | Phase 2 |
| Restaurant owner portal | Phase 2 — owners are not self-service in Phase 1 |

---

*Governed by master-architecture.md, backend-standards.md, frontend-standards.md, and security-standards.md. All conflicts resolved by those documents.*

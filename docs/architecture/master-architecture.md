# Chow Here — Master Architecture Document

**Status:** AUTHORITATIVE  
**Version:** 1.1  
**Last Updated:** 2026-05-30  
**Governed By:** CTO / Principal Engineer

---

## 0. PURPOSE OF THIS DOCUMENT

This document is the single source of truth for the Chow Here platform architecture. It defines:

- What we are building and why
- How the system is structured
- What the engineering rules are
- What is in scope and what is not
- How every subsystem relates to every other

All implementation decisions must be traceable back to this document. If an engineer is unsure whether something should be built, how it should be structured, or whether a pattern is acceptable — this document answers that question first.

**If this document does not cover it, do not build it until it is added here.**

---

## 1. PRODUCT IDENTITY

### 1.1 What Chow Here Is

Chow Here is a **trusted dish-first Nigerian food discovery platform**.

It is:
- A structured food intelligence platform
- A geo-aware dish discovery engine
- A trusted restaurant verification system
- A searchable Nigerian food knowledge graph

### 1.2 What Chow Here Is NOT

Chow Here is explicitly not:
- A food delivery application
- A restaurant management SaaS
- A social food network
- A reservation system
- A loyalty or rewards platform

Any feature that moves the platform toward these categories is **out of scope** for Phase 1 and must be formally reviewed before being added to any phase.

### 1.3 The Core Product Guarantee

Every restaurant listing on Chow Here has been verified. Every dish listed has been confirmed at that restaurant. Every search result reflects trusted intelligence.

**This guarantee is the product. Protecting it is the primary engineering constraint.**

---

## 2. PHASE 1 SCOPE

Phase 1 delivers exactly these systems and nothing else:

| # | System | Description |
|---|---|---|
| 1 | Dish Taxonomy System | Canonical dish names, aliases, regional naming, categories |
| 2 | Restaurant Intake System | Restaurant submission, dish listing, photo upload |
| 3 | Restaurant Verification Workflow | State machine, confidence scoring, audit trail |
| 4 | Restaurant Listing System | Public-facing verified restaurant profiles |
| 5 | Dish Search & Discovery | Full-text search, alias matching, geo-aware ranking |
| 6 | User Accounts | Authentication, profiles, saved dishes |
| 7 | Saved Dishes & Food History | User-specific dish bookmarks and discovery history |
| 8 | Admin Verification Dashboard | Internal tool for reviewing and approving submissions |
| 9 | SEO Infrastructure | Structured data, meta generation, sitemap, OpenGraph |
| 10 | Structured Food Intelligence | Data collection forms and intelligence layer |

### 2.1 Explicit Non-Scope (Phase 1)

The following must never appear in Phase 1 code, schemas, or planning:

- Delivery or dispatch systems
- Real-time order tracking
- Social feeds or activity streams
- AI recommendations or vector embeddings
- Restaurant SaaS analytics dashboards
- External developer APIs
- Complex advertising systems
- Loyalty or points systems
- In-app messaging or chat
- Advanced ML-based recommendation engines
- Payment processing (beyond future Paystack integration stubs)

---

## 3. SYSTEM ARCHITECTURE

### 3.1 Architectural Approach

Chow Here follows a **feature-based monolith** architecture deployed on Vercel (frontend) and Supabase (PostgreSQL). There is no microservice decomposition in Phase 1.

**Decision rationale:** The team size, user scale, and trust requirements of Phase 1 do not justify distributed systems. Operational complexity is a trust risk. A well-structured monolith with clear feature module boundaries is the correct choice.

### 3.2 High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE                              │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                   NEXT.JS APPLICATION                   │     │
│  │                                                         │     │
│  │  ┌────────────────┐    ┌────────────────────────────┐   │     │
│  │  │  APP ROUTER    │    │     API ROUTE HANDLERS     │   │     │
│  │  │  (Pages/UI)    │    │     /api/v1/...            │   │     │
│  │  └───────┬────────┘    └────────────┬───────────────┘   │     │
│  │          │                          │                   │     │
│  │          └──────────┬───────────────┘                   │     │
│  │                     ▼                                   │     │
│  │          ┌──────────────────────┐                       │     │
│  │          │   FEATURE MODULES    │                       │     │
│  │          │  /features/          │                       │     │
│  │          │    auth/             │                       │     │
│  │          │    restaurants/      │                       │     │
│  │          │    dishes/           │                       │     │
│  │          │    search/           │                       │     │
│  │          │    verification/     │                       │     │
│  │          │    admin/            │                       │     │
│  │          │    users/            │                       │     │
│  │          └──────────┬───────────┘                       │     │
│  │                     │                                   │     │
│  │          ┌──────────▼───────────┐                       │     │
│  │          │   PRISMA ORM         │                       │     │
│  │          └──────────┬───────────┘                       │     │
│  └─────────────────────┼───────────────────────────────────┘     │
└────────────────────────┼─────────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  SUPABASE POSTGRES  │
              │  (Primary Database) │
              └─────────────────────┘

External Services:
  Cloudinary  → Media storage and CDN
  Resend      → Transactional email
  Paystack    → Payment (future stub only in Phase 1)
```

### 3.3 Request Flow

```
User Request
  → Vercel CDN (static assets, cached responses)
  → Next.js App Router (server components, layout)
  → Feature Module (business logic)
  → Prisma ORM (database access)
  → PostgreSQL (Supabase)
  → Response (typed, validated)
```

### 3.4 Data Flow — Intake to Discovery

```
Restaurant Submits Form
  → Intake validation (Zod)
  → Draft saved to DB (status: DRAFT)
  → Submission confirmed (status: PENDING_REVIEW)
  → Admin queue entry created
  → Admin reviews
  → Transition: APPROVED or REJECTED or NEEDS_INFO
  → If APPROVED:
      → Restaurant marked LIVE
      → Confidence score calculated
      → Search index updated (FTS vectors refreshed)
      → Restaurant appears in discovery
```

---

## 4. FEATURE MODULE ARCHITECTURE

### 4.1 Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Public routes
│   │   ├── page.tsx              # Home / search
│   │   ├── search/
│   │   ├── restaurants/[slug]/
│   │   └── dishes/[slug]/
│   ├── (auth)/                   # Auth routes
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/                # Authenticated user routes
│   │   ├── saved/
│   │   └── history/
│   ├── admin/                    # Admin routes (role-guarded)
│   │   ├── queue/
│   │   ├── restaurants/
│   │   └── dishes/
│   └── api/
│       └── v1/                   # All API routes
│           ├── restaurants/
│           ├── dishes/
│           ├── search/
│           ├── verification/
│           ├── admin/
│           └── users/
│
├── features/                     # Business logic modules
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── schemas/
│   │   └── types/
│   ├── restaurants/
│   ├── dishes/
│   ├── search/
│   ├── verification/
│   ├── admin/
│   └── users/
│
├── lib/                          # Shared utilities (minimal)
│   ├── db.ts                     # Prisma client singleton
│   ├── auth.ts                   # Auth helpers
│   └── errors.ts                 # Error types
│
├── components/                   # Shared UI components only
│   ├── ui/                       # shadcn/ui components
│   └── layout/                   # Shared layout components
│
└── types/                        # Global type definitions
    └── index.ts
```

### 4.2 Feature Module Internal Structure

Every feature module must follow this internal structure:

```
features/[feature-name]/
├── components/       # UI components for this feature
├── hooks/            # React hooks (data fetching, state)
├── services/         # Pure business logic functions
├── schemas/          # Zod validation schemas
├── types/            # TypeScript interfaces for this feature
└── index.ts          # Public exports from this module
```

**Rules:**
- Feature modules do not import from other feature modules directly
- Cross-feature communication goes through shared `lib/` or API routes
- No circular dependencies between feature modules
- The `index.ts` barrel file controls what is public

### 4.3 What Belongs Where

| Code Type | Location |
|---|---|
| Page layout, routing | `app/` |
| API route handlers | `app/api/v1/` |
| Business logic, services | `features/[name]/services/` |
| React components (feature-specific) | `features/[name]/components/` |
| React hooks | `features/[name]/hooks/` |
| Zod schemas | `features/[name]/schemas/` |
| Shared UI only (buttons, inputs) | `components/ui/` |
| Shared layout (header, footer) | `components/layout/` |
| DB client | `lib/db.ts` (singleton) |
| Utility functions | `lib/` only if used by 3+ features |

---

## 5. TECH STACK

### 5.1 Decisions and Rationale

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 14+ App Router | SSR for SEO-critical dish/restaurant pages; API routes for backend; single deployment unit |
| Language | TypeScript (strict) | Type safety across full stack; Prisma types align with DB |
| Styling | TailwindCSS | Utility-first; consistent design system; no CSS-in-JS overhead |
| Components | shadcn/ui | Copy-owned components; no library lock-in; Tailwind-native |
| Forms | React Hook Form + Zod | Performance-first forms; schema-driven validation |
| Server state | TanStack Query v5 | Intelligent caching; background refetch; optimistic updates |
| Client state | Zustand | Minimal; only for auth state and UI preferences |
| ORM | Prisma | Type-safe queries; migration management; PostgreSQL-optimized |
| Database | PostgreSQL | Full-text search; pg_trgm; JSONB; proven reliability |
| Hosting | Vercel | SSR, edge caching, preview deployments |
| DB Hosting | Supabase | Managed PostgreSQL; PgBouncer pooling; sufficient for Phase 1 scale |
| Media | Cloudinary | CDN, transformation, moderation APIs |
| Email | Resend | Developer-first; React Email templates |
| Payments | Paystack | Nigerian payment infrastructure (Phase 1 stub only) |

### 5.2 Versions (Pinned)

All dependencies must be pinned to exact versions in `package.json`. No `^` or `~` ranges in production.

---

## 6. API DESIGN STANDARDS

### 6.1 Route Naming Convention

```
/api/v1/[resource]/[id?]/[sub-resource?]

Examples:
GET    /api/v1/restaurants
POST   /api/v1/restaurants
GET    /api/v1/restaurants/:id
PATCH  /api/v1/restaurants/:id
GET    /api/v1/restaurants/:id/dishes
POST   /api/v1/verification/submit
POST   /api/v1/admin/restaurants/:id/approve
```

### 6.2 Response Shape (Required)

All API responses must conform to this shape:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {              // Optional — for paginated responses
    "total": number,
    "page": number,
    "limit": number
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",   // Machine-readable
    "message": "...",             // Human-readable
    "fields": { ... }             // Optional: field-level errors
  }
}
```

### 6.3 HTTP Status Code Rules

| Situation | Status Code |
|---|---|
| Success with data | 200 |
| Created successfully | 201 |
| Success with no content | 204 |
| Validation error | 422 |
| Unauthorized (not logged in) | 401 |
| Forbidden (logged in, wrong role) | 403 |
| Resource not found | 404 |
| Rate limit exceeded | 429 |
| Server error | 500 |

Never return 200 with an error in the body. Never return 500 for a validation error.

---

## 7. ENVIRONMENT CONFIGURATION

### 7.1 Required Environment Variables

```bash
# Database — Supabase requires two connection strings
DATABASE_URL=    # Transaction mode pooler (PgBouncer, port 6543) — runtime queries
DIRECT_URL=      # Direct connection (port 5432) — migrations only

# Authentication
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_ENV=development|staging|production
```

### 7.2 Environment Tiers

| Tier | Purpose | Database |
|---|---|---|
| `development` | Local dev | Local PostgreSQL (Docker or Supabase CLI) |
| `staging` | Pre-production review | Supabase staging project |
| `production` | Live platform | Supabase production project |

**Rule:** No production environment variables may ever be committed to source control. No `.env` files are committed. `.env.example` (no values) is the only committed env file.

---

## 8. ENGINEERING LAWS

These rules are not suggestions. They govern all implementation decisions.

### Law 1: System Before UI
Build backend, schema, and validation before any frontend component. The sequence is always: **Schema → Service → API → UI**.

### Law 2: Explicit Over Implicit
No hidden magic. No auto-discovered plugins. No convention-over-configuration that creates invisible behavior. Every behavior must be traceable to a line of code.

### Law 3: Small Files
Maximum file size: 300 lines. If a file exceeds this, it must be split by responsibility.

### Law 4: No Premature Abstraction
Abstract only when the same logic exists in three or more places. Do not create utilities, factories, or generic patterns speculatively.

### Law 5: Strict Types
No `any`. No `as unknown as`. No `@ts-ignore` without a comment explaining why. Zod validates at runtime boundaries. Prisma types own the DB layer.

### Law 6: Ownership Validation Everywhere
Every mutation API route must check that the requesting user owns or has rights to the resource being modified. This check is in the route handler, not only middleware.

### Law 7: No Untracked State Transitions
The verification state machine is the only code allowed to change `verificationStatus`. No direct DB updates to this field from any other module.

### Law 8: Trust is a Feature
Any change that increases the number of listings at the expense of listing quality is wrong. Reject it. A smaller set of trusted listings is always better.

### Law 9: No Speculative Infrastructure
Do not add queue workers, event buses, caching layers, or distributed systems until a specific, measured bottleneck requires them.

### Law 10: Incremental Delivery
No feature is built in a single giant commit. Every feature is built in stages: schema, then service, then API, then UI.

---

## 9. DEPLOYMENT MODEL

### 9.1 Branching Strategy

```
main          → Production (auto-deploy to Vercel production)
staging       → Staging (auto-deploy to Vercel preview)
feature/*     → Feature branches (Vercel preview per PR)
fix/*         → Bug fix branches
```

### 9.2 Deployment Checklist

Before merging to `main`:
- [ ] All TypeScript errors resolved
- [ ] All Zod schemas validated against real data
- [ ] Database migrations tested on staging
- [ ] No `.env` values committed
- [ ] No `console.log` debug output in production paths
- [ ] No `TODO` comments that hide incomplete security implementations

### 9.3 Database Migration Rules

- All schema changes via Prisma migrations
- Migrations must be reviewed before staging deployment
- Destructive migrations (column drops, table drops) require explicit confirmation in PR description
- Never run `prisma db push` in production — always `prisma migrate deploy`

---

## 10. MONITORING AND OBSERVABILITY (Phase 1)

Phase 1 observability is minimal but intentional:

| Signal | Mechanism |
|---|---|
| Application errors | Vercel error logs |
| Slow queries | Prisma query logging in development |
| Verification queue depth | Admin dashboard metric |
| Failed submissions | DB count query |

No third-party APM in Phase 1. Vercel built-in analytics is sufficient.

---

## 11. DOCUMENT RELATIONSHIPS

```
master-architecture.md       ← THIS DOCUMENT (top-level law)
    │
    ├── backend-standards.md     (API, services, DB access patterns)
    ├── frontend-standards.md    (UI, components, state, forms)
    ├── security-standards.md    (auth, RBAC, input validation, uploads)
    └── testing-standards.md     (testing philosophy, coverage, patterns)

    Tracks (implementation blueprints):
    ├── database-track.md
    ├── restaurant-intake-track.md
    ├── verification-system-track.md
    ├── search-system-track.md
    └── admin-platform-track.md
```

All tracks must comply with all architecture and standards documents. Any conflict between a track document and a standards document is resolved in favor of the standards document.

---

*This document is living but stable. Changes require explicit versioning and justification.*

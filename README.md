# Chow Here

**Chow Here** is a dish-first food discovery platform for Nigeria. You search for a dish — not a restaurant name — and find verified restaurants that actually serve it. Every listing on the platform has been reviewed by a human admin. That guarantee is the product.

This repository is the full application: Next.js frontend, REST API, verification workflow, admin dashboard, and search engine — deployed as a single unit on Vercel with PostgreSQL on Supabase.

---

## The Verification Model

Every restaurant goes through a five-state review pipeline before it can appear in search results:

```
DRAFT → PENDING_REVIEW → APPROVED
                       → NEEDS_INFO → PENDING_REVIEW
                       → REJECTED
```

A restaurant cannot reach `APPROVED` with a confidence score below 0.40. That score is calculated from seven signals — phone number validity, verified photos, dish count, address quality, description completeness, contact availability, and admin approval itself. The state machine is the only code permitted to write `verificationStatus`. Everything else in the system is physically prevented from touching that field.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui (Radix primitives) |
| Forms | React Hook Form + Zod |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| ORM | Prisma 6 |
| Database | PostgreSQL (Supabase, PgBouncer pooling) |
| Search | PostgreSQL FTS + `pg_trgm` |
| Media | Cloudinary |
| Email | Resend + React Email |
| Auth | NextAuth.js v4 (JWT, CredentialsProvider) |
| Testing | Vitest |
| Deployment | Vercel |

---

## Getting Started

**Prerequisites:** Node.js 20+, a Supabase project, Cloudinary account, Resend API key.

```bash
git clone https://github.com/zortojnr/chow-here.git
cd chow-here
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

Run migrations and seed the dish catalog:

```bash
npm run db:migrate
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

---

## Environment Variables

```bash
# Supabase — two connection strings are required
DATABASE_URL=       # Transaction mode pooler (port 6543) — used at runtime
DIRECT_URL=         # Direct connection (port 5432) — used for migrations only

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_ENV=development
```

Supabase requires both URLs because PgBouncer (transaction mode) does not support `SET` commands used by Prisma migrations. Migrations always run over the direct connection.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (public)/           # Consumer-facing pages
│   ├── admin/              # Admin dashboard (role-guarded)
│   └── api/v1/             # REST API routes
│
├── features/               # Feature modules (self-contained)
│   ├── restaurants/        # Intake, listing, slug, duplicate detection
│   ├── verification/       # State machine, scoring, notifications, intelligence
│   └── admin/              # Queue service, admin schemas
│
├── lib/                    # Shared infrastructure
│   ├── db.ts               # Dual Prisma clients (standard + verification-only)
│   ├── auth.ts             # NextAuth config, requireRole()
│   ├── errors.ts           # Typed error hierarchy
│   ├── api-response.ts     # Standard response envelope
│   └── rate-limit.ts       # PostgreSQL-backed rate limiting
│
└── components/
    ├── ui/                 # shadcn/ui components
    └── layout/             # Shared layout (nav, shells)
```

Feature modules do not import from each other. Cross-feature communication goes through `lib/` or API routes. The `index.ts` barrel file in each feature controls what is exported.

---

## API

All routes live under `/api/v1/`. Responses always follow the same envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

### Public

| Method | Route | Auth | Rate Limit |
|---|---|---|---|
| `GET` | `/api/v1/restaurants` | None | 60/IP/min |
| `GET` | `/api/v1/restaurants/:slug` | None | 120/IP/min |
| `GET` | `/api/v1/restaurants/:slug/dishes` | None | 60/IP/min |
| `POST` | `/api/v1/intake/restaurants` | None | 3/IP/hour |
| `POST` | `/api/v1/intake/photos` | None | 20/IP/day |
| `GET` | `/api/v1/intake/dishes?q=` | None | 60/IP/min |
| `POST` | `/api/v1/verification/respond/:token` | Signed JWT | Once (replay-protected) |

### Admin (ADMIN or SUPER role required)

| Method | Route |
|---|---|
| `GET` | `/api/v1/admin/verification/queue` |
| `GET` | `/api/v1/admin/verification/:id` |
| `POST` | `/api/v1/admin/verification/:id/approve` |
| `POST` | `/api/v1/admin/verification/:id/reject` |
| `POST` | `/api/v1/admin/verification/:id/needs-info` |
| `POST` | `/api/v1/admin/verification/:id/assign` |
| `GET` | `/api/v1/admin/verification/:id/history` |
| `POST` | `/api/v1/admin/verification/:id/score/override` *(SUPER only)* |
| `PATCH` | `/api/v1/admin/restaurants/:id/dishes/:dishId/verify` |
| `PATCH` | `/api/v1/admin/restaurants/:id/photos/:photoId/verify` |
| `PATCH` | `/api/v1/admin/restaurants/:id/intelligence` |

Admin routes have two authentication gates: Next.js middleware (layer 1) and `getServerSession()` + `requireRole()` inside each handler (layer 2). Both must be present.

---

## Tests

```bash
npm test
```

927 tests across 35 test files, all passing. Coverage spans the auth layer, all service classes, all API route handlers, and shared utilities. Vitest is the test runner; no database mocking — service tests mock Prisma at the boundary.

```bash
npm run type-check   # tsc --noEmit, currently 0 errors
npm run lint         # ESLint
```

---

## Database

```bash
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:migrate       # Apply pending migrations (dev only)
npm run db:migrate:deploy # Apply migrations in production — use this, not db push
npm run db:seed          # Seed Nigerian dish taxonomy and city data
npm run db:studio        # Open Prisma Studio
npm run db:reset         # ⚠ Wipes and re-migrates (dev only)
```

Never run `prisma db push` in production. Always use `prisma migrate deploy`.

---

## What's Built

- Database schema, all migrations, seed data
- Full verification pipeline: state machine, confidence scoring, audit trail, email notifications, NEEDS_INFO token flow
- Restaurant intake: submission, duplicate detection, photo upload with EXIF stripping
- Admin APIs: queue management, all verification transitions, intelligence enrichment
- Public listing APIs: restaurant index, restaurant profile, restaurant dishes
- Consumer pages: restaurant browse grid, restaurant profile page (SSR + ISR, JSON-LD, OG tags)
- Admin shell: sidebar, queue page with filters and pagination, dark mode

**Not yet built:** public intake form (`/submit`), submitter response page, admin review screen, admin intelligence edit screen, user accounts, dish search UI.

---

## Architecture Notes

The verification state machine (`features/verification/services/state-machine.ts`) enforces all valid transitions. No other code can approve, reject, or move a restaurant through the pipeline — the Prisma extension in `lib/db.ts` throws immediately if any other module attempts to write `verificationStatus`.

The confidence score is stored in two places (`Restaurant.confidenceScore` and `VerificationRecord.confidenceScore`) and both are always updated in the same transaction. They must never diverge.

Rate limiting is implemented against PostgreSQL — no Redis in Phase 1.

Full architecture documentation is in `docs/architecture/` and `docs/tracks/`.

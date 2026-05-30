# Chow Here — Backend Standards

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Document:** master-architecture.md

---

## 0. PURPOSE

This document defines the engineering standards for all backend code in the Chow Here platform. Every API route handler, service function, database query, and server-side utility must conform to these standards.

These are not style preferences. They are engineering laws.

---

## 1. ROUTE HANDLER STANDARDS

### 1.1 File Structure

Every API route handler lives in `app/api/v1/` and follows Next.js App Router conventions:

```
app/api/v1/
├── restaurants/
│   ├── route.ts              # GET /api/v1/restaurants, POST /api/v1/restaurants
│   └── [id]/
│       ├── route.ts          # GET, PATCH /api/v1/restaurants/:id
│       └── dishes/
│           └── route.ts      # GET /api/v1/restaurants/:id/dishes
├── search/
│   └── route.ts
└── admin/
    └── restaurants/
        └── [id]/
            └── approve/
                └── route.ts
```

### 1.2 Required Handler Shape

Every route handler must follow this pattern without exception:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 1. Define the request schema at the top of the file
const CreateRestaurantSchema = z.object({ ... })

// 2. Export named HTTP method functions only
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 3. Authentication check first
    const session = await getServerSession()
    if (!session) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
    }

    // 4. Parse and validate input
    const body = await request.json()
    const result = CreateRestaurantSchema.safeParse(body)
    if (!result.success) {
      return validationErrorResponse(result.error)
    }

    // 5. Authorization check (ownership, role)
    // This is NOT optional. See security-standards.md.

    // 6. Business logic via service function
    const restaurant = await RestaurantService.create(result.data, session.user.id)

    // 7. Return typed success response
    return successResponse(restaurant, 201)

  } catch (error) {
    return serverErrorResponse(error)
  }
}
```

### 1.3 Route Handler Rules

- Route handlers contain **no business logic**. Business logic lives in service functions.
- Route handlers are responsible for: parsing input, validating input, checking auth, calling a service, returning a response.
- Route handlers must never directly call Prisma. They call service functions.
- Route handlers must never throw — they always return a `NextResponse`.
- Maximum route handler length: 80 lines. If it exceeds this, extract logic to a service.

### 1.4 Response Helper Functions

All response helpers live in `lib/api-response.ts`:

```typescript
export function successResponse<T>(data: T, status = 200): NextResponse
export function errorResponse(code: string, message: string, status: number): NextResponse
export function validationErrorResponse(error: z.ZodError): NextResponse
export function serverErrorResponse(error: unknown): NextResponse
```

These must be used consistently. Do not construct raw `NextResponse.json()` objects in route handlers.

---

## 2. SERVICE LAYER STANDARDS

### 2.1 What a Service Is

A service is a pure TypeScript module in `features/[name]/services/`. It contains the business logic for a feature domain.

Services:
- Accept validated input (already parsed by the route handler)
- Contain all business rules
- Call Prisma directly
- Return typed results
- Throw typed errors on failure

### 2.2 Service Function Rules

```typescript
// features/restaurants/services/restaurant.service.ts

export const RestaurantService = {
  async create(data: CreateRestaurantInput, userId: string): Promise<Restaurant> {
    // Business logic lives here
    // Prisma calls happen here
    // Throws RestaurantError on failure
  },

  async findById(id: string): Promise<Restaurant | null> {
    // ...
  }
} as const
```

Rules:
- Services are plain objects with async functions. No classes unless there is a specific reason.
- Service functions have explicit return types.
- Services never return raw Prisma types to route handlers — they return mapped application types.
- Services throw typed errors from `lib/errors.ts`, never plain strings.
- No service function exceeds 60 lines. If it does, decompose it.

### 2.3 Service Composition

Services may call other services **only within the same feature domain**. Cross-feature calls go through explicit imports of the other feature's public API (`features/[name]/index.ts`).

No circular dependencies. If feature A needs feature B and feature B needs feature A, the shared logic belongs in `lib/`.

---

## 3. DATABASE ACCESS STANDARDS

### 3.1 Prisma Client Singleton

The Prisma client is a singleton. It lives in `lib/db.ts` and is imported from there everywhere:

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

Never instantiate `new PrismaClient()` anywhere else in the codebase.

### 3.2 Query Standards

**Select only what you need:**

```typescript
// WRONG — selects everything
const restaurant = await db.restaurant.findUnique({ where: { id } })

// CORRECT — selects only what is returned to the client
const restaurant = await db.restaurant.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    slug: true,
    verificationStatus: true,
    confidenceScore: true,
  }
})
```

**Never return raw DB models to the API layer.** Map Prisma results to application types in the service.

### 3.3 Transaction Rules

Use Prisma transactions for any operation that touches more than one table:

```typescript
const result = await db.$transaction(async (tx) => {
  const restaurant = await tx.restaurant.create({ data: { ... } })
  const event = await tx.verificationEvent.create({ data: { restaurantId: restaurant.id, ... } })
  return { restaurant, event }
})
```

If a transaction fails, no partial data is committed.

### 3.4 Pagination

All list queries must be paginated. No unbounded queries:

```typescript
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

async function findMany(page: number, limit: number) {
  const safeLimit = Math.min(limit, MAX_PAGE_SIZE)
  return db.restaurant.findMany({
    skip: (page - 1) * safeLimit,
    take: safeLimit,
    orderBy: { createdAt: 'desc' }
  })
}
```

### 3.5 Soft Deletes

Most records use soft deletes, not hard deletes. The pattern:

```prisma
model Restaurant {
  deletedAt  DateTime?
}
```

All queries must filter `where: { deletedAt: null }` by default. Create a Prisma middleware or query extension to enforce this globally.

---

## 4. INPUT VALIDATION STANDARDS

### 4.1 Validation at Every Boundary

Validation happens at the API boundary (route handler) using Zod. By the time data reaches a service function, it is already validated and typed.

**Never skip validation.** Even for admin routes. Even for internal-only endpoints.

### 4.2 Zod Schema Conventions

All schemas live in `features/[name]/schemas/`:

```typescript
// features/restaurants/schemas/restaurant.schema.ts

import { z } from 'zod'

export const CreateRestaurantSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  address: z.string().min(5).max(300).trim(),
  city: z.string().min(2).max(100).trim(),
  state: z.string().min(2).max(100).trim(),
  phone: z.string().regex(/^\+234[0-9]{10}$/, 'Must be a valid Nigerian phone number'),
  priceRange: z.enum(['BUDGET', 'MID', 'UPSCALE']),
})

export type CreateRestaurantInput = z.infer<typeof CreateRestaurantSchema>
```

Rules:
- Every schema exports its inferred TypeScript type
- String fields always include `.trim()`
- String fields always have explicit `.min()` and `.max()`
- Phone numbers are validated to Nigerian format before storage
- Enum fields use Zod enum — never raw string with manual checks

### 4.3 Partial Updates

For PATCH endpoints, use `.partial()` from Zod:

```typescript
export const UpdateRestaurantSchema = CreateRestaurantSchema.partial()
```

Never accept an unbounded PATCH that could update any field. Define an explicit update schema.

---

## 5. ERROR HANDLING STANDARDS

### 5.1 Error Types

Typed errors live in `lib/errors.ts`:

```typescript
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super('FORBIDDEN', 'You do not have permission to perform this action', 403)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422)
  }
}
```

### 5.2 Error Handling in Route Handlers

The `try/catch` in every route handler catches `AppError` instances and maps them to the correct HTTP response. The `serverErrorResponse` helper handles unknown errors:

```typescript
function serverErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return errorResponse(error.code, error.message, error.statusCode)
  }
  // Never expose internal error details in production
  const message = process.env.NODE_ENV === 'development'
    ? (error instanceof Error ? error.message : 'Unknown error')
    : 'An internal error occurred'
  return errorResponse('INTERNAL_ERROR', message, 500)
}
```

**Never expose stack traces, DB query errors, or internal variable names in production error responses.**

### 5.3 Logging

Error logging in production goes to Vercel logs only. No `console.log` in production code paths.

```typescript
// In development: log freely
// In production: log only errors with enough context to debug
if (process.env.NODE_ENV !== 'production') {
  console.error('[Service Error]', error)
}
```

---

## 6. AUTHENTICATION AND SESSION STANDARDS

### 6.1 Session Access

Session access in route handlers:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
  }
  // ...
}
```

### 6.2 User ID Source

The authenticated user's ID always comes from the server-side session. Never trust a `userId` from the request body or query string for ownership operations.

### 6.3 Role Checking

Role checks happen via a shared helper, not inline comparisons:

```typescript
// lib/auth.ts
export function requireRole(session: Session, role: UserRole): void {
  if (session.user.role !== role) {
    throw new ForbiddenError()
  }
}
```

---

## 7. RATE LIMITING STANDARDS

Phase 1 rate limiting is IP-based, implemented in **API route handlers** using the `RateLimit` PostgreSQL table (see `database-track.md §3.12`). This avoids the operational cost of Redis and the runtime limitations of edge middleware.

Rate limit checks run as the first operation in each affected route handler, before authentication or validation.

| Endpoint Type | Limit |
|---|---|
| Restaurant intake submission | 3 per IP per hour |
| Auth (login/register) | 10 per IP per 15 minutes |
| Search queries | 60 per IP per minute |
| Photo uploads | 5 per submission, 20 per IP per day |
| Admin endpoints | 200 per session per minute |

Rate limit exceeded responses return HTTP 429 with `Retry-After` header.

---

## 8. EXTERNAL SERVICE INTEGRATION STANDARDS

### 8.1 Cloudinary

All Cloudinary operations go through `lib/cloudinary.ts`. Never call Cloudinary SDK directly from service functions. The upload helper:

- Validates file type (magic bytes, not MIME header)
- Validates file size (≤5MB)
- Strips EXIF metadata
- Assigns folder by resource type
- Returns only the CDN URL (never the Cloudinary public ID in API responses)

### 8.2 Resend (Email)

Email templates are React components in `features/[name]/emails/`. The send function lives in `lib/email.ts`. No inline HTML email construction.

### 8.3 Circuit Breaking

If an external service call fails, the error must be caught and handled gracefully. A Cloudinary failure must not crash a restaurant submission — it should return a `SERVICE_UNAVAILABLE` error that the UI can handle.

---

## 9. LOGGING AND OBSERVABILITY STANDARDS

### 9.1 What to Log

| Event | Log Level |
|---|---|
| Restaurant submission received | INFO |
| Verification state transition | INFO (with who, what, when) |
| Authentication failures | WARN |
| Rate limit exceeded | WARN |
| Unhandled errors | ERROR |
| DB query failures | ERROR |
| External service failures | ERROR |

### 9.2 What NOT to Log

- Passwords (obviously)
- Full request bodies containing PII
- Session tokens or JWTs
- Credit card or payment data
- Full SQL queries in production

---

## 10. NAMING CONVENTIONS

| Entity | Convention | Example |
|---|---|---|
| Files | kebab-case | `restaurant.service.ts` |
| Functions | camelCase | `createRestaurant()` |
| Types/Interfaces | PascalCase | `CreateRestaurantInput` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PHOTO_SIZE` |
| DB models | PascalCase | `Restaurant` |
| DB fields | camelCase | `verificationStatus` |
| API routes | kebab-case | `/api/v1/restaurant-dishes` |
| Environment vars | SCREAMING_SNAKE_CASE | `DATABASE_URL` |

---

*Governed by master-architecture.md. All conflicts resolved by that document.*

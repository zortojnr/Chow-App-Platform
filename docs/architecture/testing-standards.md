# Chow Here — Testing Standards

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Document:** master-architecture.md

---

## 0. PURPOSE

This document defines the testing philosophy, strategy, tooling, and enforcement standards for the Chow Here platform. Testing is not optional — it is a production quality gate.

The goal is not 100% coverage. The goal is **high-confidence coverage of the things that matter most**, maintained efficiently over time.

---

## 1. TESTING PHILOSOPHY

### 1.1 Test What Breaks in Production

Tests exist to catch regressions and validate critical behavior. Write tests that would have caught real bugs, not tests that prove simple code works. The following categories are always worth testing:

- Business logic with conditional branches
- State machine transitions (verification workflow)
- Authorization checks (can the right people do the right things?)
- Input validation (does bad input get correctly rejected?)
- Search logic (does filtering and ranking produce correct results?)
- Data transformations (are Prisma results correctly mapped to API responses?)

### 1.2 Test Pyramid

```
         ┌─────────────┐
         │    E2E      │  ← Few, slow, high-value user journeys
         │   Tests     │
        ─┴─────────────┴─
       ┌─────────────────┐
       │  Integration    │  ← API routes, DB interactions
       │    Tests        │
      ─┴─────────────────┴─
    ┌─────────────────────┐
    │      Unit Tests     │  ← Services, utils, schemas, state machines
    └─────────────────────┘
```

The pyramid is weighted toward unit and integration tests. E2E tests cover only the most critical user flows.

### 1.3 What Not to Test

Do not write tests for:
- Simple getters and setters with no logic
- Prisma model types (Prisma owns this)
- Next.js framework behavior
- Third-party library internals
- Constants and enums with no logic

Test the logic your team wrote, not the tools you depend on.

---

## 2. TOOLING

### 2.1 Test Stack

| Layer | Tool | Reason |
|---|---|---|
| Unit + Integration | Vitest | Fast, native TypeScript, compatible with ESM |
| React component | React Testing Library | Tests behavior, not implementation |
| Custom hooks | `@testing-library/react` `renderHook` | Standard hook testing |
| E2E | Playwright | Reliable cross-browser, good DX |
| API mocking (unit) | `msw` (Mock Service Worker) | Intercepts fetch, realistic |
| DB (integration) | Real PostgreSQL test DB | No SQLite; behavior differences matter |
| Assertion | Vitest built-in (`expect`) | No chai/jasmine ambiguity |

### 2.2 Test Database

Integration tests use a **real PostgreSQL instance** (not SQLite). A separate test database is maintained in the Railway staging environment. The test database is reset before each test run.

```bash
# Environment variable for test runs
DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/chowhere_test
```

**Reason:** SQLite does not support `pg_trgm`, full-text search, or all PostgreSQL constraint behaviors. Testing against SQLite would give false confidence for the search and validation systems.

### 2.3 File Naming Conventions

```
restaurant.service.test.ts     — unit test for a service
restaurant.route.test.ts       — integration test for an API route
verification.state.test.ts     — unit test for a state machine
search.test.ts                 — integration test for search
restaurant-intake.spec.ts      — Playwright E2E spec
```

Test files live next to the code they test. E2E spec files live in `tests/e2e/`.

---

## 3. UNIT TESTING STANDARDS

### 3.1 What Gets Unit Tests

| Code | Required? |
|---|---|
| Service functions with business logic | ✅ Required |
| Zod schema validation | ✅ Required |
| Verification state machine | ✅ Required |
| Confidence score calculation | ✅ Required |
| Utility functions with conditional logic | ✅ Required |
| Simple data mappers | Optional |
| Zustand stores | Optional |
| UI components | Optional (covered by integration) |

### 3.2 Unit Test Structure

All unit tests follow the **Arrange-Act-Assert** pattern:

```typescript
// features/restaurants/services/restaurant.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RestaurantService } from './restaurant.service'
import { db } from '@/lib/db'

// Mock the database module — unit tests do not touch the DB
vi.mock('@/lib/db', () => ({ db: { restaurant: { create: vi.fn() } } }))

describe('RestaurantService', () => {
  describe('create()', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('creates a restaurant with DRAFT status', async () => {
      // Arrange
      const mockRestaurant = { id: 'uuid-1', name: 'Iya Basira Kitchen', status: 'DRAFT' }
      vi.mocked(db.restaurant.create).mockResolvedValue(mockRestaurant as any)
      
      const input = { name: 'Iya Basira Kitchen', city: 'Lagos', ... }

      // Act
      const result = await RestaurantService.create(input, 'user-id-1')

      // Assert
      expect(result.name).toBe('Iya Basira Kitchen')
      expect(db.restaurant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) })
      )
    })

    it('throws when required fields are missing', async () => {
      await expect(
        RestaurantService.create({ name: '' } as any, 'user-id-1')
      ).rejects.toThrow()
    })
  })
})
```

### 3.3 Verification State Machine Tests

The verification state machine is the most critical business logic in Phase 1. It requires exhaustive testing of all valid and invalid transitions:

```typescript
describe('VerificationStateMachine', () => {
  it('allows DRAFT → PENDING_REVIEW transition', ...)
  it('allows PENDING_REVIEW → APPROVED transition by ADMIN', ...)
  it('allows PENDING_REVIEW → REJECTED transition by ADMIN', ...)
  it('allows PENDING_REVIEW → NEEDS_INFO transition by ADMIN', ...)
  it('allows NEEDS_INFO → PENDING_REVIEW transition', ...)
  it('prevents APPROVED → DRAFT transition', ...)
  it('prevents non-ADMIN from approving', ...)
  it('prevents non-ADMIN from rejecting', ...)
  it('records an audit event on every transition', ...)
  it('throws on invalid transition attempt', ...)
})
```

All state machine transition tests must cover both the happy path and the rejection path.

### 3.4 Zod Schema Tests

Every Zod schema must be tested with valid inputs, boundary inputs, and invalid inputs:

```typescript
describe('CreateRestaurantSchema', () => {
  it('accepts valid restaurant data', () => {
    const result = CreateRestaurantSchema.safeParse(validRestaurant)
    expect(result.success).toBe(true)
  })

  it('rejects name shorter than 2 characters', () => {
    const result = CreateRestaurantSchema.safeParse({ ...validRestaurant, name: 'A' })
    expect(result.success).toBe(false)
    expect(result.error?.errors[0].path).toContain('name')
  })

  it('rejects invalid Nigerian phone number', () => {
    const result = CreateRestaurantSchema.safeParse({ ...validRestaurant, phone: '08012345678' })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from string fields', () => {
    const result = CreateRestaurantSchema.safeParse({ ...validRestaurant, name: '  Iya Basira  ' })
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('Iya Basira')
  })
})
```

---

## 4. INTEGRATION TESTING STANDARDS

### 4.1 What Gets Integration Tests

Integration tests verify that route handlers, services, and the database work together correctly.

| System | Required? |
|---|---|
| All POST/PATCH API routes | ✅ Required |
| All authentication routes | ✅ Required |
| All admin action routes | ✅ Required |
| Verification state transitions (via API) | ✅ Required |
| Search query accuracy | ✅ Required |
| GET list endpoints with pagination | Optional |
| GET single resource endpoints | Optional |

### 4.2 Integration Test Structure

Integration tests for API routes use a test HTTP client (not mounting the full Next.js server, but calling route handlers directly with mocked `NextRequest`):

```typescript
// features/restaurants/restaurant.route.test.ts
import { POST } from '@/app/api/v1/restaurants/route'
import { createTestRequest, createAdminSession } from '@/tests/utils'
import { db } from '@/lib/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('POST /api/v1/restaurants', () => {
  beforeEach(async () => {
    // Seed test DB with minimal required data
    await db.user.create({ data: testAdminUser })
  })

  afterEach(async () => {
    // Clean up test data
    await db.$transaction([
      db.restaurant.deleteMany(),
      db.user.deleteMany(),
    ])
  })

  it('creates a restaurant submission as DRAFT', async () => {
    const request = createTestRequest('POST', validRestaurantPayload)
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.verificationStatus).toBe('DRAFT')
  })

  it('rejects unauthenticated requests to protected routes', async () => {
    const request = createTestRequest('POST', validPayload, { session: null })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 422 for invalid input', async () => {
    const request = createTestRequest('POST', { name: '' })
    const response = await POST(request)
    expect(response.status).toBe(422)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })
})
```

### 4.3 Test Helpers

Test helpers live in `tests/utils/`:

```
tests/
├── utils/
│   ├── create-test-request.ts    — Creates mock NextRequest instances
│   ├── create-test-session.ts    — Creates mock sessions for different roles
│   ├── db-helpers.ts             — Seed and cleanup utilities
│   └── fixtures/                 — Static test data objects
│       ├── restaurant.fixture.ts
│       ├── dish.fixture.ts
│       └── user.fixture.ts
└── e2e/
    ├── restaurant-intake.spec.ts
    ├── search.spec.ts
    └── admin-verify.spec.ts
```

---

## 5. E2E TESTING STANDARDS

### 5.1 What Gets E2E Tests

E2E tests are expensive to write and maintain. Only the following user flows get E2E coverage in Phase 1:

| Flow | Why |
|---|---|
| Restaurant intake form submission | Most important intake path |
| Dish search and result display | Core discovery flow |
| Admin approve/reject a restaurant | Critical verification action |
| User registration and login | Authentication integrity |
| User saves a dish | Core engagement action |

### 5.2 Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,           // Sequential — shared test DB
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  }
})
```

### 5.3 E2E Test Structure

```typescript
// tests/e2e/restaurant-intake.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Restaurant Intake', () => {
  test('submits a new restaurant for review', async ({ page }) => {
    await page.goto('/submit')

    await page.getByLabel('Restaurant Name').fill('Iya Basira Kitchen')
    await page.getByLabel('City').selectOption('Lagos')
    await page.getByLabel('Address').fill('14 Bode Thomas Street, Surulere')
    await page.getByLabel('Phone Number').fill('+2348012345678')
    await page.getByRole('button', { name: 'Submit Restaurant' }).click()

    await expect(page.getByText('Your restaurant has been submitted for review')).toBeVisible()
  })
})
```

### 5.4 E2E Isolation

Each E2E test run uses a seeded test database state. Tests must not depend on the order of other tests. Each `test.describe` block seeds the data it needs.

---

## 6. COVERAGE REQUIREMENTS

### 6.1 Minimum Coverage Targets (Phase 1)

| Module | Required Coverage |
|---|---|
| Verification state machine | 100% |
| Auth service | 90% |
| Restaurant service | 80% |
| Search service | 80% |
| Confidence score algorithm | 100% |
| Zod schemas (critical) | 90% |
| API route handlers | 75% |

### 6.2 Coverage is Not a Goal — It's a Floor

Meeting coverage thresholds does not mean the code is well-tested. Coverage is enforced as a minimum floor to prevent obviously undertested code. 

A 100% covered function with only one test case that uses perfect input is poorly tested. Write tests for edge cases, boundaries, and failures — not just the happy path.

### 6.3 Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        global: {
          statements: 75,
          branches: 70,
          functions: 75,
          lines: 75,
        }
      },
      exclude: [
        'src/components/ui/**',  // shadcn/ui — not our code
        '**/*.d.ts',
        '**/index.ts',           // Barrel files
      ]
    }
  }
})
```

---

## 7. CI/CD TESTING INTEGRATION

### 7.1 PR Merge Requirement

No PR may be merged to `main` or `staging` without:
- All unit tests passing
- All integration tests passing
- TypeScript compilation succeeding (`tsc --noEmit`)
- Coverage thresholds met

### 7.2 Test Pipeline Stages

```
push → 
  Stage 1: TypeScript check (tsc --noEmit)
  Stage 2: Unit tests (fast, no DB)
  Stage 3: Integration tests (requires test DB)
  Stage 4: E2E tests (full app + DB, on main/staging only)
```

E2E tests run only on pushes to `main` and `staging` branches, not on every feature branch push (too slow for PR feedback loops).

---

## 8. TEST DATA MANAGEMENT

### 8.1 Fixtures

Test fixtures are typed objects in `tests/utils/fixtures/`. They represent realistic but non-real data:

```typescript
// tests/utils/fixtures/restaurant.fixture.ts
export const validRestaurantFixture = {
  name: 'Iya Basira Kitchen',
  address: '14 Bode Thomas Street, Surulere',
  city: 'Lagos',
  state: 'Lagos',
  phone: '+2348012345678',
  priceRange: 'MID' as const,
  cuisineType: 'Nigerian',
}
```

### 8.2 No Hardcoded IDs

Tests must not hardcode UUIDs or database IDs. IDs are generated at runtime during test setup and captured for use within the test.

### 8.3 Database Cleanup

Integration tests are responsible for cleaning up their own data. Use `afterEach` or `afterAll` with targeted `deleteMany` calls. Prefer targeted cleanup over blanket table truncation.

---

*Governed by master-architecture.md. All conflicts resolved by that document.*

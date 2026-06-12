# Chow Here — Database Track

**Status:** AUTHORITATIVE BLUEPRINT  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Documents:** master-architecture.md, data-governance.md, backend-standards.md

---

## 0. PURPOSE

This track document defines the complete database implementation plan for Phase 1. It specifies the Prisma schema design, migration strategy, index strategy, seed data requirements, and the step-by-step implementation sequence.

The database is the foundation. Everything else is built on top of it. It must be right before any other system is implemented.

**This is a blueprint, not implementation code.** The schema defined here is the design spec that Prisma schema files will implement.

---

## 1. IMPLEMENTATION PHILOSOPHY

### 1.1 Database-First

The implementation sequence for every system is:
1. Design schema (this document)
2. Write Prisma schema
3. Generate and review migration
4. Run migration on development
5. Verify with seed data
6. Build service on top

No service is written before its schema is defined and migrated.

### 1.2 Start Minimal, Evolve Correctly

The initial schema includes only what Phase 1 requires. Fields that are "useful later" are not added speculatively. Every field in the schema has a system that writes it and a system that reads it.

---

## 2. TECHNOLOGY

| Component | Choice | Rationale |
|---|---|---|
| ORM | Prisma | Type-safe, migration-managed, PostgreSQL-optimized |
| Database | PostgreSQL 15+ | FTS support, pg_trgm, JSONB, proven |
| Extensions | `uuid-ossp`, `pg_trgm`, `unaccent` | UUID generation, fuzzy search, accent-insensitive search |
| Hosting | Railway (managed PostgreSQL) | Sufficient for Phase 1; simple ops |

### 2.1 Required PostgreSQL Extensions

These extensions must be enabled before any schema migrations run:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
```

These are added as the first migration in the project.

---

## 3. FULL SCHEMA DESIGN

### 3.1 User

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  role          UserRole  @default(USER)
  displayName   String?   @db.VarChar(100)
  avatarUrl     String?

  savedDishes   SavedDish[]
  searchHistory UserSearchHistory[]

  emailVerified Boolean   @default(false)
  deletedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
  @@index([deletedAt])
}

enum UserRole {
  USER
  ADMIN
  SUPER
  SYSTEM   // For system-initiated VerificationEvents only — never assigned to User.role
}
```

### 3.2 DishTaxonomy

```prisma
model DishTaxonomy {
  id             String   @id @default(uuid())
  canonicalName  String   @unique @db.VarChar(150)
  aliases        String[]
  category       DishCategory
  subcategory    String?  @db.VarChar(100)
  description    String?  @db.VarChar(500)
  isActive       Boolean  @default(true)

  restaurantDishes RestaurantDish[]

  createdBy      String           // Admin user ID
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // FTS vector — populated by DB trigger
  searchVector   Unsupported("tsvector")?

  @@index([isActive])
  @@index([category])
}

enum DishCategory {
  RICE_DISHES
  SOUPS
  SWALLOW
  PROTEIN
  STREET_FOOD
  DRINKS
  SNACKS
  BREAKFAST
  DESSERTS
}
```

### 3.3 Restaurant

```prisma
model Restaurant {
  id                  String             @id @default(uuid())
  name                String             @db.VarChar(150)
  slug                String             @unique @db.VarChar(200)
  description         String?            @db.VarChar(500)

  // Location
  address             String             @db.VarChar(300)
  city                String             @db.VarChar(100)
  state               String             @db.VarChar(100)
  area                String?            @db.VarChar(100)

  // GPS coordinates — Phase 2 (Track 7: Navigation & Location Intelligence)
  // Set by admin via geocoding service or manual coordinate override.
  // NEVER populated from user GPS data — only from server-side geocoding of the restaurant address.
  // null = not yet geocoded. Consumers only receive these when geocodeConf is HIGH or MEDIUM.
  latitude            Float?             // WGS84 decimal degrees
  longitude           Float?             // WGS84 decimal degrees
  geocodedAt          DateTime?          // when coordinates were last set
  geocodeConf         String?            @db.VarChar(10)  // 'HIGH' | 'MEDIUM' | 'LOW'

  // Contact
  phone               String             @db.VarChar(20)
  email               String?            @db.VarChar(150)
  website             String?            @db.VarChar(300)

  // Classification
  priceRange          PriceRange
  cuisineTypes        String[]

  // Media
  thumbnailUrl        String?
  thumbnailBlurHash   String?

  // Verification
  verificationStatus  VerificationStatus @default(DRAFT)
  confidenceScore     Decimal            @default(0) @db.Decimal(4, 3)

  // Submitter (may be anonymous)
  submittedBy         String?            // User ID, null if anonymous

  // Relations
  dishes              RestaurantDish[]
  verification        VerificationRecord?
  photos              RestaurantPhoto[]

  deletedAt           DateTime?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  // FTS vector — populated by DB trigger
  searchVector        Unsupported("tsvector")?

  @@index([verificationStatus])
  @@index([city])
  @@index([slug])
  @@index([deletedAt])
  @@index([confidenceScore])
  // Partial index on geocoded restaurants (Track 7) — added via raw SQL migration
  // CREATE INDEX idx_restaurant_geocoded ON "Restaurant" (latitude, longitude)
  // WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
}

enum VerificationStatus {
  DRAFT
  PENDING_REVIEW
  NEEDS_INFO
  APPROVED
  REJECTED
}

enum PriceRange {
  BUDGET
  MID
  UPSCALE
}
```

### 3.4 RestaurantDish

```prisma
model RestaurantDish {
  id                  String               @id @default(uuid())
  restaurantId        String
  dishId              String

  // Restaurant-specific overrides
  nameAsServed        String?              @db.VarChar(150)
  description         String?              @db.VarChar(300)
  price               Decimal?             @db.Decimal(10, 2)

  availabilityStatus  DishAvailabilityStatus @default(UNKNOWN)
  verifiedAt          DateTime?

  restaurant          Restaurant           @relation(fields: [restaurantId], references: [id])
  dish                DishTaxonomy         @relation(fields: [dishId], references: [id])

  deletedAt           DateTime?
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  @@unique([restaurantId, dishId])   // A restaurant can only list a dish once
  @@index([restaurantId])
  @@index([dishId])
  @@index([availabilityStatus])
}

enum DishAvailabilityStatus {
  ALWAYS_AVAILABLE
  SEASONAL
  WEEKEND_ONLY
  ON_ORDER
  UNKNOWN
}
```

### 3.5 RestaurantPhoto

```prisma
model RestaurantPhoto {
  id           String   @id @default(uuid())
  restaurantId String
  url          String   // Cloudinary CDN URL
  caption      String?  @db.VarChar(200)
  isPrimary    Boolean  @default(false)
  isVerified   Boolean  @default(false)  // Admin confirmed photo is authentic

  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])

  uploadedBy   String?  // User ID or null for admin uploads
  createdAt    DateTime @default(now())

  @@index([restaurantId])
}
```

### 3.6 VerificationRecord

```prisma
model VerificationRecord {
  id                  String             @id @default(uuid())
  restaurantId        String             @unique
  currentStatus       VerificationStatus
  confidenceScore     Decimal            @db.Decimal(4, 3)
  
  // Scoring breakdown (stored for admin visibility)
  scoreBreakdown      Json               // { verification: 0.4, photos: 0.15, ... }

  // Submitter contact (stored here, not on Restaurant — submitter may be anonymous)
  submitterEmail      String?            @db.VarChar(150)   // For sending notifications to submitter

  // Admin notes
  internalNotes       String?            @db.Text   // NEVER returned in public API responses
  feedbackToSubmitter String?            @db.Text   // Admin-written text sent to submitter on NEEDS_INFO/REJECTED

  assignedTo          String?            // Admin user ID currently reviewing

  restaurant          Restaurant         @relation(fields: [restaurantId], references: [id])
  events              VerificationEvent[]

  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([currentStatus])
  @@index([assignedTo])
}
```

### 3.7 VerificationEvent

```prisma
model VerificationEvent {
  id                   String             @id @default(uuid())
  verificationRecordId String
  restaurantId         String

  // Transition details
  fromStatus           VerificationStatus?
  toStatus             VerificationStatus
  reason               String?            @db.VarChar(500)

  // Actor
  actorId              String             // Admin user ID
  actorRole            UserRole
  ipAddress            String             @db.VarChar(50)

  verificationRecord   VerificationRecord @relation(fields: [verificationRecordId], references: [id])

  // Immutable — no updatedAt
  createdAt            DateTime           @default(now())

  @@index([restaurantId])
  @@index([verificationRecordId])
  @@index([createdAt])
}
```

### 3.8 SavedDish

```prisma
model SavedDish {
  id               String   @id @default(uuid())
  userId           String
  restaurantDishId String
  notes            String?  @db.VarChar(300)

  user             User              @relation(fields: [userId], references: [id])

  createdAt        DateTime          @default(now())

  @@unique([userId, restaurantDishId])  // Can only save a dish-restaurant pair once
  @@index([userId])
}
```

### 3.9 UserSearchHistory

```prisma
model UserSearchHistory {
  id        String   @id @default(uuid())
  userId    String
  query     String   @db.VarChar(200)
  location  String?  @db.VarChar(100)

  user      User     @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

### 3.10 SearchLog (Anonymous)

```prisma
model SearchLog {
  id          String   @id @default(uuid())
  query       String   @db.VarChar(200)
  location    String?  @db.VarChar(100)
  resultCount Int
  createdAt   DateTime @default(now())

  @@index([createdAt])
  @@index([query])
}
```

### 3.11 UsedVerificationToken

Single-use token replay prevention for the submitter response flow. When a submitter uses their `NEEDS_INFO` response link, the token hash is stored here to prevent re-use.

```prisma
model UsedVerificationToken {
  id        String   @id @default(uuid())
  tokenHash String   @unique   // SHA-256 hash of the JWT token
  usedAt    DateTime @default(now())

  @@index([usedAt])
}
```

Tokens are checked against this table before processing a submitter response. A match returns `410 Gone`.

### 3.12 RateLimit

PostgreSQL-backed rate limiting table. Avoids the operational cost of Redis in Phase 1. Used for intake submission and photo upload rate limits.

```prisma
model RateLimit {
  id          String   @id @default(uuid())
  key         String   @unique   // e.g. "intake:1.2.3.4", "photo_upload:1.2.3.4"
  count       Int      @default(1)
  windowStart DateTime @default(now())

  @@index([key])
  @@index([windowStart])
}
```

Rate limit logic: check if `windowStart` is within the current window (e.g. 1 hour). If yes, increment `count`. If `count` exceeds the limit, reject. If `windowStart` is outside the window, reset `count = 1` and `windowStart = now()`.

---

## 4. INDEX STRATEGY

### 4.1 Required Indexes

Beyond the indexes defined in the Prisma schema above, the following partial and functional indexes are required:

```sql
-- Column names are quoted camelCase — Prisma generates camelCase identifiers,
-- not snake_case. Unquoted identifiers in PostgreSQL fold to lowercase and
-- will NOT match Prisma's mixed-case column names.

-- Partial index: only APPROVED restaurants
CREATE INDEX idx_restaurant_approved
  ON "Restaurant" ("city", "confidenceScore" DESC)
  WHERE "verificationStatus" = 'APPROVED' AND "deletedAt" IS NULL;

-- Partial index: available dishes for approved restaurants
CREATE INDEX idx_restaurant_dish_available
  ON "RestaurantDish" ("restaurantId", "dishId")
  WHERE "deletedAt" IS NULL;

-- FTS indexes (created by search triggers)
CREATE INDEX idx_dish_fts ON "DishTaxonomy" USING GIN ("searchVector");
CREATE INDEX idx_restaurant_fts ON "Restaurant" USING GIN ("searchVector");

-- Trigram indexes
-- Note: aliases trigram index excluded — gin_trgm_ops cannot operate on text[].
-- Alias fuzzy coverage is handled by the FTS trigger (array_to_string weight B).
CREATE INDEX idx_dish_name_trgm ON "DishTaxonomy" USING GIN ("canonicalName" gin_trgm_ops);
CREATE INDEX idx_restaurant_name_trgm ON "Restaurant" USING GIN ("name" gin_trgm_ops);
```

These indexes are added via raw SQL in separate Prisma migration files after the initial schema migration runs. See `prisma/migration-scripts/` for the exact SQL and `scripts/create-custom-migrations.ps1` for the deployment helper.

### 4.2 Index Maintenance

- Indexes are created with `CONCURRENTLY` in production to avoid table locks
- Index bloat is monitored quarterly once the platform is live
- Unused indexes (identified by `pg_stat_user_indexes`) are removed

---

## 5. DATABASE TRIGGER DEFINITIONS

Two triggers maintain the FTS search vectors. These are raw SQL added to migrations:

```sql
-- Column names are quoted camelCase — Prisma generates camelCase identifiers.
-- Unquoted PL/pgSQL identifiers fold to lowercase; mixed-case columns MUST be quoted.

-- Dish search vector trigger
CREATE OR REPLACE FUNCTION update_dish_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', unaccent(coalesce(NEW."canonicalName", ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(array_to_string(NEW."aliases", ' '), ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."subcategory", ''))), 'C') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."description", ''))), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_dish_search_vector
BEFORE INSERT OR UPDATE OF "canonicalName", "aliases", "subcategory", "description"
ON "DishTaxonomy"
FOR EACH ROW EXECUTE FUNCTION update_dish_search_vector();

-- Restaurant search vector trigger
CREATE OR REPLACE FUNCTION update_restaurant_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', unaccent(coalesce(NEW."name", ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."city", ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."area", ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."description", ''))), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_restaurant_search_vector
BEFORE INSERT OR UPDATE OF "name", "city", "area", "description"
ON "Restaurant"
FOR EACH ROW EXECUTE FUNCTION update_restaurant_search_vector();
```

The `unaccent` extension handles accented characters (relevant for some Nigerian food names and city names with diacritics). Canonical SQL for these triggers lives in `prisma/migration-scripts/010_add_fts_triggers.sql`.

---

## 6. SEED DATA REQUIREMENTS

### 6.1 Required Seed Data (Before Launch)

The platform cannot function without seed data in these categories:

| Data | Minimum at Launch | Source |
|---|---|---|
| Dish taxonomy entries | 50 canonical dishes | Manual curation by team |
| Nigerian cities list | All 36 state capitals + major cities | Public data |
| Nigerian states list | All 36 states + FCT | Public data |
| Test admin user | 1 SUPER account | Manual |

### 6.2 Dish Taxonomy Seed Data (Minimum Set)

The following 50 dishes are the required minimum for launch. This list is curated by the team, not generated:

**Rice Dishes (10):**
Jollof Rice, Fried Rice, Ofada Rice, Coconut Rice, Plain Rice, Tuwo Shinkafa, Jollof Spaghetti, Rice and Stew, Fried Rice with Chicken, Native Rice

**Soups (15):**
Egusi Soup, Efo Riro, Ogbono Soup, Banga Soup, Afang Soup, Edikang Ikong, Vegetable Soup, Groundnut Soup, Bitterleaf Soup, Okra Soup, Draw Soup, White Soup, Oha Soup, Ofe Onugbu, Miyan Kuka

**Swallow (6):**
Pounded Yam, Eba, Fufu, Amala, Semovita, Tuwo Masara

**Protein / Grills (8):**
Suya, Asun, Peppered Chicken, Peppersoup, Nkwobi, Isi Ewu, Kilishi, Grilled Fish

**Street Food / Snacks (6):**
Akara, Puff Puff, Boli, Roasted Corn, Moi Moi, Gizdodo

**Breakfast (5):**
Yam and Egg Sauce, Beans and Plantain, Akara and Pap, Ogi, Bread and Beans

### 6.3 Seed File Location

```
prisma/
├── schema.prisma
├── migrations/
│   └── ...
└── seed/
    ├── seed.ts           — Main seed runner
    ├── dishes.data.ts    — Dish taxonomy seed data
    └── cities.data.ts    — Nigerian cities and states
```

The seed runner is idempotent — running it multiple times does not create duplicate records.

---

## 7. MIGRATION SEQUENCE

### 7.1 Phase 1 Migration Plan

Migrations are numbered and executed in this sequence:

```
001_enable_extensions               — uuid-ossp, pg_trgm, unaccent
002_create_users                    — User table
003_create_dish_taxonomy            — DishTaxonomy table
004_create_restaurants              — Restaurant table
005_create_restaurant_dishes        — RestaurantDish table
006_create_restaurant_photos        — RestaurantPhoto table
007_create_verification             — VerificationRecord, VerificationEvent tables
008_create_user_features            — SavedDish, UserSearchHistory tables
009_create_search_log               — SearchLog table
010_add_fts_triggers                — FTS vector triggers and indexes
011_add_partial_indexes             — Partial and composite indexes
012_add_db_constraints              — CHECK constraints
013_create_used_verification_tokens — UsedVerificationToken table (replay prevention)
014_create_rate_limit               — RateLimit table (PostgreSQL-backed rate limiting)
```

Each migration is a separate file. Migrations are never combined after they have been run on staging.

### 7.2 Phase 2 Migration Plan

Phase 2 migrations extend the Phase 1 schema. All use `ADD COLUMN ... NULL` (no default, no NOT NULL) to avoid table rewrites on the live `Restaurant` table.

```
015_add_restaurant_coordinates      — Restaurant.latitude, .longitude, .geocodedAt, .geocodeConf
                                      + partial index idx_restaurant_geocoded
                                      Governed by: track-07-navigation-location.md §6
```

**Migration SQL (015_add_restaurant_coordinates):**

```sql
ALTER TABLE "Restaurant"
  ADD COLUMN "latitude"    DOUBLE PRECISION,
  ADD COLUMN "longitude"   DOUBLE PRECISION,
  ADD COLUMN "geocodedAt"  TIMESTAMP(3),
  ADD COLUMN "geocodeConf" VARCHAR(10);

CREATE INDEX "idx_restaurant_geocoded"
  ON "Restaurant" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
```

**Down migration:**

```sql
DROP INDEX IF EXISTS "idx_restaurant_geocoded";
ALTER TABLE "Restaurant"
  DROP COLUMN IF EXISTS "latitude",
  DROP COLUMN IF EXISTS "longitude",
  DROP COLUMN IF EXISTS "geocodedAt",
  DROP COLUMN IF EXISTS "geocodeConf";
```

**Constraints enforced at application layer (not database layer):**
- Latitude must be in the range `4.0 ≤ lat ≤ 13.9` (Nigeria bounding box)
- Longitude must be in the range `2.7 ≤ lng ≤ 14.7` (Nigeria bounding box)
- `geocodeConf` must be one of `'HIGH'`, `'MEDIUM'`, `'LOW'` — enforced by `IntelligenceUpdateSchema`
- `geocodedAt` must be set whenever `latitude`/`longitude` are set — enforced by `geocoding.service.ts`

### 7.2 Migration Rules

- Never modify a migration after it has been run on any environment
- Every migration must be reversible (include a `down` path) or explicitly documented as irreversible
- Migrations that add columns to large tables use `ADD COLUMN ... DEFAULT ...` pattern to avoid table rewrites
- Test migrations on a production-size data snapshot before running on production

---

## 8. PRISMA CLIENT CONFIGURATION

### 8.1 Middleware for Soft Delete Enforcement

A Prisma middleware extension ensures `deletedAt IS NULL` is automatically applied to all queries on soft-delete models:

```typescript
// lib/db.ts
export const db = new PrismaClient().$extends({
  query: {
    restaurant: {
      findMany: ({ args, query }) => {
        args.where = { ...args.where, deletedAt: null }
        return query(args)
      },
      findFirst: ({ args, query }) => {
        args.where = { ...args.where, deletedAt: null }
        return query(args)
      },
      findUnique: ({ args, query }) => {
        // findUnique must use findFirst for soft-delete enforcement
        // This requires explicit handling
        return query(args)
      }
    }
    // same for RestaurantDish, User
  }
})
```

Admin queries that need to see deleted records must explicitly pass `{ deletedAt: { not: null } }` to override. This is an intentional friction — admin code must be explicit about accessing deleted records.

---

## 9. IMPLEMENTATION SEQUENCE

### Step 1: Initialize Prisma
1. Install Prisma and `@prisma/client`
2. Initialize `prisma/schema.prisma` with PostgreSQL provider
3. Configure `DATABASE_URL` in `.env`

### Step 2: Extensions Migration
1. Create migration `001_enable_extensions`
2. Test extension availability on development DB

### Step 3: Core Schema Migrations
1. Implement schema per Section 3 definitions above
2. Run `prisma migrate dev` for each model group
3. Verify migrations on development DB

### Step 4: Search Infrastructure
1. Add FTS trigger migration (`010_add_fts_triggers`)
2. Add index migrations (`011_add_partial_indexes`)
3. Verify FTS with test queries

### Step 5: Seed Data
1. Write dish taxonomy seed data file
2. Write cities/states seed data file
3. Write idempotent seed runner
4. Run `prisma db seed` and verify

### Step 6: Validation
1. Run all schema constraint tests
2. Verify soft delete middleware
3. Verify FTS vectors are populated on insert
4. Run search queries against seeded data

---

*Governed by master-architecture.md and data-governance.md. All conflicts resolved by those documents.*

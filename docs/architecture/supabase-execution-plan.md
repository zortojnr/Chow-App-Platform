# Chow Here — Database Execution Plan (Supabase)

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-30  
**Replaces:** database-track.md §9 (Implementation Sequence) for Supabase infrastructure  
**Parent Documents:** master-architecture.md, database-track.md

---

## 0. PURPOSE

This document is the operational runbook for executing the Phase 1 database setup on Supabase. It replaces the Railway-oriented implementation sequence in database-track.md §9.

The schema design, migration content, trigger SQL, index strategy, and seed data defined in database-track.md are unchanged. Only the execution workflow is Supabase-specific.

---

## 1. SUPABASE COMPATIBILITY NOTES

### 1.1 What is different from Railway

| Concern | Railway | Supabase |
|---|---|---|
| Connection to DB | Single `DATABASE_URL` | Two URLs: pooler + direct |
| Prisma migrations | `prisma migrate dev` against hosted DB | Must use DIRECT_URL; `migrate dev` blocked on cloud |
| Extension schema | `public` (default) | `extensions` schema (convention) |
| Shadow database | Allowed | Blocked — `postgres` cannot `CREATE DATABASE` |
| RLS | Not applicable | Present but irrelevant for Prisma backend |

### 1.2 Why `prisma migrate dev` cannot run against Supabase cloud

`prisma migrate dev` creates a shadow database to diff schema state. On Supabase cloud, the `postgres` role cannot issue `CREATE DATABASE`. The command fails at shadow DB creation.

**Rule: `prisma migrate dev` runs only against local PostgreSQL. `prisma migrate deploy` runs against Supabase.**

### 1.3 Why two connection strings are required

Supabase routes connections through PgBouncer (transaction mode pooler, port 6543) for runtime efficiency. PgBouncer drops advisory locks that Prisma migrate depends on. Direct connection (port 5432) bypasses PgBouncer and is the only safe path for migrations.

Prisma schema is already configured for both:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // PgBouncer — runtime
  directUrl = env("DIRECT_URL")     // Direct — migrations
}
```

### 1.4 Extension schema

Extensions are created with `WITH SCHEMA extensions` in migration `001`. Supabase's default search_path includes `extensions`, so all extension functions (`unaccent()`, `gin_trgm_ops`) are accessible without schema qualification in triggers, indexes, and queries.

---

## 2. PREREQUISITES

Before executing any migration step:

- [ ] Supabase project created at supabase.com
- [ ] Project region selected (choose closest to primary user base)
- [ ] `.env` file created from `.env.example` and populated
- [ ] Node.js and npm installed locally
- [ ] `npm install` completed in project root
- [ ] Local PostgreSQL available for development (see §3)

---

## 3. LOCAL DEVELOPMENT DATABASE

`prisma migrate dev` requires local PostgreSQL. Two options:

### Option A: Supabase CLI (recommended)

The Supabase CLI runs a full local Supabase stack including PostgreSQL.

```powershell
# Install Supabase CLI
npm install -g supabase

# Start local stack
supabase start

# The CLI prints local connection strings — use these in .env for local dev:
# DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
# DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

Local Supabase mirrors the cloud environment including extension availability.

### Option B: Docker PostgreSQL

```powershell
docker run --name chow-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
# DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

Extensions must be manually enabled on the Docker instance before running migrations.

---

## 4. ENVIRONMENT CONFIGURATION

### 4.1 Connection strings

From Supabase Dashboard → Project Settings → Database → Connection string:

```bash
# .env (never committed)

# Transaction mode pooler — used by Prisma Client at runtime
# Must include ?pgbouncer=true to disable prepared statements
DATABASE_URL=postgres://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct connection — used only by prisma migrate
# IPv6 by default. If your environment is IPv4-only, use the session pooler on port 5432:
# postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
```

### 4.2 Verification

Confirm both URLs resolve before running any migration:

```powershell
npx prisma db execute --stdin --url $env:DIRECT_URL <<< "SELECT 1;"
```

---

## 5. MIGRATION EXECUTION ORDER

### Step 1 — Prisma client install

```powershell
npm install
```

### Step 2 — Confirm local DATABASE_URL points to local PostgreSQL

For `prisma migrate dev`, the `.env` must point to local PostgreSQL (Option A or B above), not Supabase cloud. DIRECT_URL may point to Supabase cloud or local — for initial dev work, use local for both.

### Step 3 — Run extension migration (001)

```powershell
npx prisma migrate dev --name enable_extensions
```

This applies `001_enable_extensions/migration.sql`. Verify extensions created:

```sql
-- In Supabase SQL Editor or local psql:
SELECT extname, extversion FROM pg_extension ORDER BY extname;
-- Expected: pg_trgm, unaccent, uuid-ossp (plus Supabase defaults)
```

### Step 4 — Run core schema migrations (002–009)

```powershell
npx prisma migrate dev --name initial_schema
```

Prisma generates and applies migrations for all models (User, DishTaxonomy, Restaurant, RestaurantDish, RestaurantPhoto, VerificationRecord, VerificationEvent, SavedDish, UserSearchHistory, SearchLog, UsedVerificationToken, RateLimit) in dependency order.

Verify migration state:

```powershell
npx prisma migrate status
```

### Step 5 — Run custom migrations (010, 011, 012)

The custom migration script creates the FTS trigger, partial index, and CHECK constraint migrations:

```powershell
.\scripts\create-custom-migrations.ps1
```

This runs `prisma migrate dev --skip-seed`, which applies:
- `010_*_add_fts_triggers` — FTS trigger functions and triggers
- `011_*_add_partial_indexes` — GIN, trigram, and partial indexes
- `012_*_add_db_constraints` — CHECK constraints

Verify triggers created:

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trig_%';
-- Expected: trig_dish_search_vector, trig_restaurant_search_vector
```

Verify indexes created:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename IN ('Restaurant', 'DishTaxonomy', 'RestaurantDish')
ORDER BY tablename, indexname;
-- Expected: idx_restaurant_approved, idx_restaurant_dish_available,
--           idx_dish_fts, idx_restaurant_fts,
--           idx_dish_name_trgm, idx_restaurant_name_trgm
```

### Step 6 — Seed data

```powershell
npm run db:seed
```

The seed runner is idempotent. Running it multiple times does not create duplicates.

Verify seed data:

```sql
SELECT COUNT(*) FROM "DishTaxonomy";   -- Expected: >= 50
SELECT COUNT(*) FROM "User" WHERE role = 'SUPER';   -- Expected: 1
```

### Step 7 — Verify FTS on seeded data

```sql
-- Dish FTS: should return matching dishes with weighted ranking
SELECT "canonicalName", ts_rank("searchVector", query) AS rank
FROM "DishTaxonomy", to_tsquery('english', 'jollof') query
WHERE "searchVector" @@ query
ORDER BY rank DESC;

-- Restaurant name trigram: should return fuzzy matches
SELECT name FROM "Restaurant"
WHERE "name" % 'Buka'   -- % is the trigram similarity operator
LIMIT 5;
```

---

## 6. DEPLOYING TO SUPABASE CLOUD

### 6.1 Required env vars on Supabase cloud

Set in Supabase Dashboard → Project Settings → Edge Functions (for Next.js on Vercel, set in Vercel environment variables):

- `DATABASE_URL` — transaction pooler URL with `?pgbouncer=true`
- `DIRECT_URL` — direct connection URL (only needed at deploy time for migrations)

### 6.2 Applying migrations to Supabase cloud

**Never use `prisma migrate dev` against Supabase cloud.** Always use:

```powershell
# Set DIRECT_URL to Supabase cloud direct connection
$env:DIRECT_URL = "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

npx prisma migrate deploy
```

`prisma migrate deploy` applies all pending migrations in order without creating a shadow database.

### 6.3 Custom migrations on Supabase cloud

The `create-custom-migrations.ps1` script is a local development tool. For Supabase cloud deployment:

1. Ensure the custom migration directories exist in `prisma/migrations/` (they are committed after running the script locally)
2. Run `prisma migrate deploy` — it picks up all unapplied migrations including the custom ones

```powershell
npx prisma migrate deploy
```

### 6.4 Seed data on Supabase cloud

```powershell
# DATABASE_URL must point to Supabase (pooler URL is fine for seed)
npx prisma db seed
```

### 6.5 CI/CD migration pattern

In the deployment pipeline (GitHub Actions or Vercel build hook):

```yaml
- name: Run database migrations
  env:
    DIRECT_URL: ${{ secrets.DIRECT_URL }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: npx prisma migrate deploy
```

`prisma migrate deploy` is idempotent — already-applied migrations are skipped.

---

## 7. MIGRATION EXECUTION ORDER SUMMARY

```
LOCAL (prisma migrate dev):
  001_enable_extensions               — uuid-ossp, pg_trgm, unaccent (WITH SCHEMA extensions)
  [initial_schema]                    — all 12 core tables (002–009, generated by Prisma)
  [custom via script]:
    010_*_add_fts_triggers            — FTS trigger functions + triggers
    011_*_add_partial_indexes         — GIN, trigram, partial indexes
    012_*_add_db_constraints          — CHECK constraints

SUPABASE CLOUD (prisma migrate deploy):
  All of the above — applied in timestamp order from prisma/migrations/
```

---

## 8. VALIDATION CHECKLIST

Before marking database setup complete:

- [ ] `npx prisma migrate status` shows all migrations applied
- [ ] `pg_extension` contains: `pg_trgm`, `unaccent`, `uuid-ossp`
- [ ] Both FTS triggers exist in `information_schema.triggers`
- [ ] All six custom indexes exist in `pg_indexes`
- [ ] All three CHECK constraints exist in `information_schema.table_constraints`
- [ ] Seed data: ≥ 50 rows in `DishTaxonomy`
- [ ] FTS test query returns ranked results for "jollof"
- [ ] Trigram test query returns fuzzy matches
- [ ] `searchVector` is not NULL on seeded DishTaxonomy rows
- [ ] `prisma migrate deploy` against Supabase cloud shows "All migrations applied"

---

## 9. SUPABASE-SPECIFIC OPERATIONAL NOTES

### Free tier limits
- 500 MB database storage
- Projects pause after 7 days of inactivity (development projects only)
- 15 maximum pooler connections on free tier

### PgBouncer transaction mode restrictions
These patterns are incompatible with `DATABASE_URL` (pooler). Use `DIRECT_URL` if any of these are needed:
- `SET` statements that must persist across transactions
- `LISTEN / NOTIFY`
- Advisory locks
- `PREPARE` / `EXECUTE` prepared statements

Prisma's standard query API is fully compatible with transaction mode.

### Row-Level Security
Supabase enables RLS on demand. Since all Prisma queries run as the `postgres` role (superuser equivalent), RLS is bypassed by default. No RLS policies are required for this application.

### Connection limits
Each Vercel serverless function invocation creates a Prisma client connection attempt. PgBouncer multiplexes these onto the actual connection pool. The `?pgbouncer=true` flag in DATABASE_URL ensures prepared statements are not used, which is required for PgBouncer transaction mode compatibility.

---

*Governed by master-architecture.md and database-track.md. All conflicts resolved by those documents.*

-- Migration: 011_add_partial_indexes
-- Partial indexes, GIN (FTS) indexes, and trigram indexes.
-- Authoritative source: database-track.md §4.1
--
-- DEPENDENCY: Must run AFTER 010_add_fts_triggers (GIN indexes require the
-- tsvector columns to exist and the pg_trgm extension to be active).
-- APPLY VIA: scripts/create-custom-migrations.ps1
--
-- Column names are quoted camelCase to match Prisma's generated schema.
-- Architecture docs used snake_case — corrected here based on the actual
-- Prisma-generated DDL (migrate diff --from-empty confirms camelCase).
--
-- Note: CONCURRENTLY cannot be used inside a transaction.
-- These tables are empty at initial launch so plain CREATE INDEX is safe
-- (no lock contention, no query impact).

-- ─────────────────────────────────────────────────────────────
-- Partial indexes
-- ─────────────────────────────────────────────────────────────

-- Only APPROVED, non-deleted restaurants — the primary search result set.
-- Covers the critical search query: WHERE "verificationStatus" = 'APPROVED' AND "deletedAt" IS NULL
-- Ordered by city + confidence score for ranked results.
CREATE INDEX idx_restaurant_approved
  ON "Restaurant" ("city", "confidenceScore" DESC)
  WHERE "verificationStatus" = 'APPROVED' AND "deletedAt" IS NULL;

-- Non-deleted dish-restaurant pairs — covers active menu lookups.
CREATE INDEX idx_restaurant_dish_available
  ON "RestaurantDish" ("restaurantId", "dishId")
  WHERE "deletedAt" IS NULL;

-- ─────────────────────────────────────────────────────────────
-- GIN indexes for full-text search
-- Requires: tsvector columns created in initial schema migration
--           trig_dish_search_vector and trig_restaurant_search_vector (migration 010)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX idx_dish_fts
  ON "DishTaxonomy" USING GIN ("searchVector");

CREATE INDEX idx_restaurant_fts
  ON "Restaurant" USING GIN ("searchVector");

-- ─────────────────────────────────────────────────────────────
-- Trigram indexes for fuzzy matching
-- Requires: pg_trgm extension (migration 001)
-- Covers: misspelling tolerance in dish and restaurant name search
-- Note: aliases fuzzy coverage is handled by the FTS trigger
--       (array_to_string weight B) — gin_trgm_ops cannot operate on text[]
-- ─────────────────────────────────────────────────────────────

CREATE INDEX idx_dish_name_trgm
  ON "DishTaxonomy" USING GIN ("canonicalName" gin_trgm_ops);

CREATE INDEX idx_restaurant_name_trgm
  ON "Restaurant" USING GIN ("name" gin_trgm_ops);

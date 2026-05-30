-- Migration: 012_add_db_constraints
-- CHECK constraints as DB-level last-resort data integrity backstop.
-- Authoritative source: data-governance.md §6.2
--
-- DEPENDENCY: Must run AFTER the initial schema migration (tables must exist).
-- APPLY VIA: scripts/create-custom-migrations.ps1
--
-- Column names are quoted camelCase to match Prisma's generated schema.
--
-- These constraints are the final validation layer. The application enforces
-- these rules via Zod at the API boundary and Prisma types at the service layer.
-- The DB constraints catch any bugs that slip through those layers.

-- ─────────────────────────────────────────────────────────────
-- Restaurant constraints
-- ─────────────────────────────────────────────────────────────

-- Confidence score must be between 0.000 and 1.000 (inclusive).
-- Calculated by VerificationService — never user-supplied.
ALTER TABLE "Restaurant"
  ADD CONSTRAINT check_confidence_score
  CHECK ("confidenceScore" >= 0 AND "confidenceScore" <= 1);

-- ─────────────────────────────────────────────────────────────
-- RestaurantDish constraints
-- ─────────────────────────────────────────────────────────────

-- Price must be positive if provided. NULL is allowed (price not listed).
ALTER TABLE "RestaurantDish"
  ADD CONSTRAINT check_price_positive
  CHECK ("price" IS NULL OR "price" > 0);

-- ─────────────────────────────────────────────────────────────
-- DishTaxonomy constraints
-- ─────────────────────────────────────────────────────────────

-- Canonical name must not be an empty or whitespace-only string.
-- The @unique constraint prevents duplicates; this prevents blank entries.
ALTER TABLE "DishTaxonomy"
  ADD CONSTRAINT check_canonical_name_nonempty
  CHECK (length(trim("canonicalName")) > 0);

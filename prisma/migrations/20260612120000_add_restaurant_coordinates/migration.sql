-- Migration: add_restaurant_coordinates
-- Adds admin-managed geocoordinates to Restaurant for proximity search and map display.
-- Required by: track-07-navigation-location.md §3
-- Governed by: database-track.md
--
-- Privacy contract (track-07 §6):
--   - User GPS coordinates are NEVER stored, logged, or sent to the database.
--   - Restaurant coordinates are set by admins via POST /api/v1/admin/restaurants/:id/geocode
--     and must never be auto-generated from user input.
--
-- Strategy:
--   1. Add four nullable columns (safe for existing rows)
--   2. Create partial index on geocoded restaurants only (lat IS NOT NULL)
--      Prisma does not support WHERE-clause partial indexes — must be in migration SQL.

-- Step 1: Add columns
ALTER TABLE "Restaurant"
  ADD COLUMN "latitude"    DOUBLE PRECISION,
  ADD COLUMN "longitude"   DOUBLE PRECISION,
  ADD COLUMN "geocodedAt"  TIMESTAMP(3),
  ADD COLUMN "geocodeConf" VARCHAR(10);

-- Step 2: Partial index — only covers restaurants that have been geocoded
CREATE INDEX "idx_restaurant_geocoded"
  ON "Restaurant" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

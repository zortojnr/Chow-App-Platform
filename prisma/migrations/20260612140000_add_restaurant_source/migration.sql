-- Migration: add_restaurant_source
-- Adds data provenance field to Restaurant.
-- 'internal_dataset' for bulk-imported records; null for user submissions.
-- Governed by: database-track.md

ALTER TABLE "Restaurant" ADD COLUMN "source" VARCHAR(50);

CREATE INDEX "idx_restaurant_source"
  ON "Restaurant" ("source")
  WHERE "source" IS NOT NULL;

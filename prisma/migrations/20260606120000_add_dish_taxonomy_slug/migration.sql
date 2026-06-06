-- Migration: add_dish_taxonomy_slug
-- Adds URL-safe slug field to DishTaxonomy for SEO dish landing pages.
-- Required by: track-04-search-discovery.md §13.1 (Step 0 prerequisite)
-- Governed by: database-track.md
--
-- Strategy:
--   1. Add column as nullable (safe for existing rows)
--   2. Backfill existing rows with slugs generated from canonicalName
--   3. Apply NOT NULL constraint after backfill
--   4. Apply UNIQUE constraint
--   5. Add index
--
-- Slug generation mirrors slug.service.ts generateSlug():
--   lowercase → strip diacritics (NFD) → strip non-alphanumeric → collapse hyphens

-- Step 1: Add column nullable
ALTER TABLE "DishTaxonomy" ADD COLUMN "slug" VARCHAR(200);

-- Step 2: Backfill existing rows
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR rec IN SELECT id, "canonicalName" FROM "DishTaxonomy" WHERE slug IS NULL LOOP
    -- Replicate generateSlug() logic in pure SQL:
    --   unaccent strips diacritics, regexp strips non-alphanumeric-or-space-or-hyphen,
    --   then collapse runs and trim edge hyphens.
    base_slug := lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(unaccent(rec."canonicalName"), '[^a-zA-Z0-9\s\-]', '', 'g'),
          '[\s\-]+', '-', 'g'
        ),
        '^-|-$', '', 'g'
      )
    );

    IF base_slug = '' THEN
      base_slug := 'dish';
    END IF;

    -- Collision resolution: append -2, -3, ... until unique
    candidate := base_slug;
    n := 2;
    WHILE EXISTS (SELECT 1 FROM "DishTaxonomy" WHERE slug = candidate AND id != rec.id) LOOP
      candidate := base_slug || '-' || n;
      n := n + 1;
    END LOOP;

    UPDATE "DishTaxonomy" SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- Step 3: Enforce NOT NULL
ALTER TABLE "DishTaxonomy" ALTER COLUMN "slug" SET NOT NULL;

-- Step 4: Unique constraint
ALTER TABLE "DishTaxonomy" ADD CONSTRAINT "DishTaxonomy_slug_key" UNIQUE ("slug");

-- Step 5: Index (for fast slug lookups on dish landing pages)
CREATE INDEX "DishTaxonomy_slug_idx" ON "DishTaxonomy" ("slug");

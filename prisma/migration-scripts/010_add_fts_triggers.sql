-- Migration: 010_add_fts_triggers
-- Full-text search vector triggers for DishTaxonomy and Restaurant.
-- Authoritative source: database-track.md §5, search-architecture.md §2.4
--
-- DEPENDENCY: Must run AFTER the initial schema migration (all tables must exist).
-- APPLY VIA: scripts/create-custom-migrations.ps1 (run after migrate dev --name initial_schema)
--
-- Column names are quoted camelCase to match Prisma's generated schema.
-- Unquoted identifiers in PostgreSQL fold to lowercase and will NOT match
-- Prisma's mixed-case column names (e.g. canonical_name != "canonicalName").
--
-- Weight rationale:
--   A = canonical/primary name   (highest signal — exact dish identity)
--   B = aliases + location       (regional names, city, area)
--   C = subcategory              (free-text: "Northern", "Yoruba", "Igbo")
--       NOT category (enum value like RICE_DISHES — not a useful search token)
--   D = description              (lowest signal — supplementary text)

-- ─────────────────────────────────────────────────────────────
-- DishTaxonomy FTS trigger
-- Fires on INSERT and on UPDATE of any of the four indexed fields.
-- ─────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────
-- Restaurant FTS trigger
-- Fires on INSERT and on UPDATE of any of the four indexed fields.
-- ─────────────────────────────────────────────────────────────

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

-- Migration: 001_enable_extensions
-- Enables required PostgreSQL extensions before any schema migrations run.
-- Must be the first migration applied. See database-track.md §2.1.
--
-- Supabase: extensions are created in the `extensions` schema per Supabase
-- convention. The `extensions` schema is in Supabase's default search_path
-- so all extension functions (unaccent, gin_trgm_ops) remain accessible
-- without schema qualification in triggers, indexes, and queries.
--
-- The postgres role used by DIRECT_URL has permission to CREATE EXTENSION.
-- IF NOT EXISTS is safe if extensions were already enabled via Dashboard.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent"  WITH SCHEMA extensions;

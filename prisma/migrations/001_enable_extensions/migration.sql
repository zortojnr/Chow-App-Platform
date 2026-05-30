-- Migration: 001_enable_extensions
-- Enables required PostgreSQL extensions before any schema migrations run.
-- Must be the first migration applied. See database-track.md §2.1.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

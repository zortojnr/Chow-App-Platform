# Chow Here — Search Architecture

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Document:** master-architecture.md

---

## 0. PURPOSE

Search is the primary discovery mechanism of the Chow Here platform. Users find restaurants by searching for dishes, not restaurant names. This is the fundamental inversion that makes the platform different.

This document defines the complete architecture for the search and discovery system: how data is indexed, how queries are processed, how results are ranked, and how the system evolves.

**Phase 1 constraint:** All search is powered by PostgreSQL full-text search (`tsvector`/`tsquery`) with `pg_trgm` for fuzzy matching. No Elasticsearch, no Typesense, no vector search. This is a deliberate constraint — PostgreSQL is sufficient for Phase 1 scale and eliminates operational complexity.

---

## 1. SEARCH MODEL

### 1.1 The Core Query Concept

A user searches for a **dish** and expects to find **restaurants that serve it**.

The search model is:
```
[dish name or alias] + [optional: city/area] → [ranked restaurant list]
```

This is categorically different from searching for a restaurant by name. Restaurant name search is secondary. Dish-first search is primary.

### 1.2 What Users Search For

Nigerian food naming has significant complexity:
- **Canonical names:** Jollof Rice, Egusi Soup, Pounded Yam
- **Regional aliases:** "Ofada Rice" vs "Parboiled Rice in sauce"
- **Misspellings:** "Egusi" → "Egushi", "Efo Riro" → "Eforiro"
- **Colloquial names:** "Party Jollof", "Smoky Jollof"
- **Preparation variants:** "Goat Peppersoup" vs "Catfish Peppersoup" (both are Peppersoup)
- **Combination searches:** "Jollof Rice and Chicken"

The search system must handle all of these. This is why the **Dish Taxonomy** is the foundation of search quality.

---

## 2. DATA MODEL FOR SEARCH

### 2.1 Searchable Entities

Phase 1 search indexes these entities:

| Entity | Searchable Fields |
|---|---|
| `Dish` (taxonomy) | canonical name, aliases, category, description |
| `RestaurantDish` (restaurant-specific dish listing) | dish name as served, notes, availability status |
| `Restaurant` | name, description, city, area/neighborhood, tags |

### 2.2 PostgreSQL Full-Text Search Index Design

The search system uses two `tsvector` columns:

**On the `Dish` table:**
```sql
ALTER TABLE "Dish" ADD COLUMN search_vector tsvector;

UPDATE "Dish" SET search_vector = 
  setweight(to_tsvector('english', coalesce(canonical_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(array_to_string(aliases, ' '), '')), 'B') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'D');

CREATE INDEX idx_dish_search ON "Dish" USING GIN (search_vector);
```

**On the `Restaurant` table:**
```sql
ALTER TABLE "Restaurant" ADD COLUMN search_vector tsvector;

UPDATE "Restaurant" SET search_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(city, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(area, '')), 'B');

CREATE INDEX idx_restaurant_search ON "Restaurant" USING GIN (search_vector);
```

**Weight meanings:**
- `A` (highest): Canonical name, restaurant name — exact match on primary identity
- `B` (high): Aliases, city, area — important contextual match
- `C` (medium): Category, description additions
- `D` (lowest): Long descriptions, supplementary text

### 2.3 Trigram Index for Fuzzy Matching

Fuzzy matching handles misspellings. `pg_trgm` indexes are added alongside the FTS indexes:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_dish_name_trgm ON "Dish" USING GIN (canonical_name gin_trgm_ops);
CREATE INDEX idx_dish_aliases_trgm ON "Dish" USING GIN (aliases gin_trgm_ops);
CREATE INDEX idx_restaurant_name_trgm ON "Restaurant" USING GIN (name gin_trgm_ops);
```

### 2.4 Keeping Search Vectors Updated

Search vectors must be kept in sync with source data. The update mechanism uses PostgreSQL triggers:

```sql
-- Trigger function for Dish search vector
-- Authoritative implementation: database-track.md §5
-- Weight C uses `subcategory` (free-text, e.g. "Northern", "Yoruba"), NOT `category`
-- (which is an enum like RICE_DISHES — not a useful search token)
CREATE OR REPLACE FUNCTION update_dish_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', unaccent(coalesce(NEW.canonical_name, ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(array_to_string(NEW.aliases, ' '), ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW.subcategory, ''))), 'C') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW.description, ''))), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_dish_search_vector
BEFORE INSERT OR UPDATE OF canonical_name, aliases, subcategory, description
ON "DishTaxonomy"
FOR EACH ROW EXECUTE FUNCTION update_dish_search_vector();
```

This ensures the search vector is always current when a dish is inserted or updated. Prisma migrations include these trigger definitions. The canonical trigger SQL lives in `database-track.md §5` — this section must remain consistent with it.

---

## 3. SEARCH QUERY PIPELINE

### 3.1 Query Flow

```
User types "Jollof Rice Lagos"
  → SearchService.query(input)
  → parseSearchQuery(input)        — tokenize, identify dish + location
  → buildTsQuery(dishTerms)        — convert to tsquery with prefix matching
  → executeSearch(tsQuery, filters) — run FTS + trigram hybrid
  → rankResults(rawResults)        — apply confidence + availability scoring
  → formatResults(rankedResults)   — map to API response shape
  → return SearchResult[]
```

### 3.2 Query Parsing

```typescript
// features/search/services/query-parser.ts

interface ParsedQuery {
  dishTerms: string[]    // e.g., ['jollof', 'rice']
  location: string | null  // e.g., 'Lagos'
  rawQuery: string
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const normalized = raw.toLowerCase().trim()
  
  // Nigerian city/state name extraction
  const knownLocations = ['lagos', 'abuja', 'port harcourt', 'ibadan', 'kano', 'benin city']
  const foundLocation = knownLocations.find(loc => normalized.includes(loc)) ?? null
  
  // Remove location from dish terms
  const dishTerms = normalized
    .replace(foundLocation ?? '', '')
    .split(/\s+/)
    .filter(term => term.length > 1)
  
  return { dishTerms, location: foundLocation, rawQuery: raw }
}
```

### 3.3 Query Execution Strategy

The search uses a **two-phase approach**:

**Phase 1 — Exact FTS match:**
```sql
SELECT 
  d.id,
  d.canonical_name,
  ts_rank(d.search_vector, query) AS rank
FROM "Dish" d, to_tsquery('english', $1) query
WHERE d.search_vector @@ query
ORDER BY rank DESC
LIMIT 20
```

**Phase 2 — Fuzzy fallback (if Phase 1 returns < 3 results):**
```sql
SELECT
  d.id,
  d.canonical_name,
  similarity(d.canonical_name, $1) AS sim_score
FROM "Dish" d
WHERE similarity(d.canonical_name, $1) > 0.3
ORDER BY sim_score DESC
LIMIT 10
```

Results from both phases are merged and deduplicated. Phase 1 results rank above Phase 2 results.

### 3.4 Restaurant Resolution

After identifying matching dishes, the search resolves which restaurants serve those dishes:

```sql
SELECT 
  r.id,
  r.name,
  r.slug,
  r.city,
  r.area,
  r.confidence_score,
  r.verification_status,
  rd.dish_name_as_served,
  rd.availability_status,
  rd.price
FROM "RestaurantDish" rd
JOIN "Restaurant" r ON rd.restaurant_id = r.id
WHERE rd.dish_id = ANY($1::uuid[])          -- from dish search results
  AND r.verification_status = 'APPROVED'    -- ONLY verified restaurants
  AND r.deleted_at IS NULL
  AND ($2::text IS NULL OR r.city ILIKE $2) -- optional city filter
ORDER BY 
  r.confidence_score DESC,
  rd.availability_status = 'ALWAYS_AVAILABLE' DESC,
  r.name ASC
```

**Critical rule:** Search results must **only** include `APPROVED` restaurants. Pending or rejected listings are invisible to search. This is the trust guarantee.

---

## 4. RANKING AND SCORING

### 4.1 Result Ranking Model

Results are ranked by a composite score:

```
final_score = (
  fts_rank * 0.40 +           -- Full-text relevance
  confidence_score * 0.35 +   -- Restaurant trust score
  availability_bonus * 0.15 + -- Dish is confirmed available
  recency_bonus * 0.10        -- Recently verified/updated
)
```

All weights are configurable via environment variables in future phases. For Phase 1, they are constants.

### 4.2 Confidence Score Definition

The confidence score is a restaurant-level trust metric (0.000 to 1.000) calculated from:

| Signal | Weight | Earned When |
|---|---|---|
| Phone number provided and valid | +0.20 | `phone` is present and passes Nigerian phone regex |
| At least 1 verified photo | +0.15 | `RestaurantPhoto.isVerified = true` |
| At least 3 dishes linked | +0.15 | 3+ active `RestaurantDish` records |
| Admin manually approved | +0.25 | `verificationStatus = APPROVED` |
| Description provided (≥50 chars) | +0.10 | `description.length >= 50` |
| Address is detailed (street-level) | +0.10 | `address.length >= 20` |
| Website or email present | +0.05 | `website OR email` is non-null |

The confidence score is calculated by `VerificationService.calculateConfidenceScore()` and stored on the `Restaurant` record. It is recalculated on every verification state change. The canonical implementation is defined in `verification-system-track.md §3.2`.

### 4.3 Availability Status

`RestaurantDish.availabilityStatus` is an enum:

```typescript
enum DishAvailabilityStatus {
  ALWAYS_AVAILABLE = 'ALWAYS_AVAILABLE',   // Always on menu
  SEASONAL = 'SEASONAL',                   // Seasonal/periodic
  WEEKEND_ONLY = 'WEEKEND_ONLY',           // Fridays–Sundays
  ON_ORDER = 'ON_ORDER',                   // Must be pre-ordered
  UNKNOWN = 'UNKNOWN',                     // Not confirmed
}
```

Availability status affects ranking. `ALWAYS_AVAILABLE` dishes rank higher than `UNKNOWN`.

---

## 5. GEO-AWARE SEARCH

### 5.1 Phase 1 Geo Approach

Phase 1 does **not** require GPS coordinates or PostGIS. Geo-awareness is implemented through structured location fields:

- `Restaurant.city` — Nigerian city (Lagos, Abuja, Port Harcourt, etc.)
- `Restaurant.state` — Nigerian state
- `Restaurant.area` — Neighborhood/area (Surulere, Lekki, Ikeja, etc.)

City-level filtering is applied as a WHERE clause. Area-level filtering is applied as a secondary sort boost.

### 5.2 Location Filter Application

```typescript
// Geo filter in search query
const cityFilter = parsed.location
  ? { city: { contains: parsed.location, mode: 'insensitive' as const } }
  : undefined
```

If no location is provided, results from all cities are returned, ranked by confidence score.

### 5.3 Phase 2 Geo Path (Not Phase 1)

In a future phase, if GPS-based distance search is needed:
- Add `latitude` and `longitude` fields to `Restaurant`
- Add PostGIS extension to PostgreSQL
- Implement radius-based search using `ST_DWithin`

This path is documented here to prevent premature implementation of PostGIS in Phase 1.

---

## 6. SEARCH API DESIGN

### 6.1 Search Endpoint

```
GET /api/v1/search?q={query}&city={city}&page={page}&limit={limit}
```

Parameters:
| Param | Required | Type | Default |
|---|---|---|---|
| `q` | Yes | string | — |
| `city` | No | string | null (all cities) |
| `page` | No | integer | 1 |
| `limit` | No | integer (max 20) | 10 |

### 6.2 Search Response Shape

```typescript
interface SearchResponse {
  success: true
  data: {
    query: string
    location: string | null
    results: SearchResult[]
    suggestions: string[]    // For "did you mean" — from trigram near-misses
  }
  meta: {
    total: number
    page: number
    limit: number
    searchTime: number  // ms — for internal diagnostics only
  }
}

interface SearchResult {
  restaurant: {
    id: string
    name: string
    slug: string
    city: string
    area: string | null
    verificationBadge: 'VERIFIED' | 'TRUSTED'  // Display label
    confidenceScore: number
    thumbnailUrl: string | null
  }
  dish: {
    canonicalName: string
    nameAsServed: string | null   // How this restaurant calls it
    availabilityStatus: DishAvailabilityStatus
    priceRange: string | null
  }
  relevanceScore: number   // For debugging; only in non-production responses
}
```

### 6.3 Search Validation

```typescript
export const SearchQuerySchema = z.object({
  q: z.string().min(2).max(200).trim(),
  city: z.string().max(100).trim().optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})
```

Minimum query length of 2 characters prevents trivially expensive queries. Maximum of 200 characters prevents oversized input.

---

## 7. SEARCH QUALITY CONTROLS

### 7.1 Trusted-Only Results

This cannot be stated enough times: search results must **only** include restaurants with `verificationStatus = 'APPROVED'`. This is enforced as a non-negotiable WHERE clause, not a filter that can be accidentally omitted.

The `SearchService` has a constant that is always applied:

```typescript
const SEARCH_STATUS_FILTER = { verificationStatus: 'APPROVED' } as const
```

This constant is always included in every search query. It is never conditional.

### 7.2 Empty Result Handling

When a search returns zero results:
- Do not return an error
- Do return suggestions (from fuzzy match near-misses)
- Include "no results found" messaging with the original query echoed back
- Log the zero-result query for future taxonomy improvement

Zero-result queries are valuable signals for expanding the dish taxonomy.

### 7.3 Search Analytics

Phase 1 collects basic search analytics to the `SearchLog` table (not a user-tracking table):

```prisma
model SearchLog {
  id          String   @id @default(uuid())
  query       String
  location    String?
  resultCount Int
  createdAt   DateTime @default(now())
  // No userId — anonymous
}
```

These logs are used to identify missing dish coverage and improve the taxonomy. They are anonymous and do not contain user identifiers.

---

## 8. DISH TAXONOMY AS SEARCH FOUNDATION

### 8.1 Why Taxonomy Drives Search Quality

The dish taxonomy is not a UI nicety — it is the index that makes search trustworthy. Without structured taxonomy:
- "Jollof Rice" and "Jollof" match different results
- "Egusi Soup" and "Egusi" don't resolve to the same dish
- Regional aliases ("Draw Soup" vs "Okra Soup") don't cross-link

The taxonomy defines:
- Canonical dish names (the authoritative name)
- Aliases (all acceptable alternate names)
- Categories (soups, rice dishes, protein dishes, street food, etc.)
- Sub-categories
- Common misspellings

### 8.2 Taxonomy Maintenance

The dish taxonomy is admin-managed. Adding a new alias to a dish in the taxonomy immediately improves search coverage for all restaurants that serve that dish.

**This is why taxonomy must be built before search is built.** See `database-track.md` for the full taxonomy schema.

---

## 9. SEARCH SYSTEM CONSTRAINTS (Phase 1)

The following are explicitly out of scope for Phase 1 search:

| Feature | Reason Not in Phase 1 |
|---|---|
| Vector/semantic search ("similar dishes") | Operational complexity; PostgreSQL FTS is sufficient |
| Real-time search-as-you-type (autocomplete) | Requires debounce + additional endpoints; v1.1 feature |
| Search within a specific restaurant | Can be implemented as a filter, not a separate system |
| Image-based dish search | Out of scope entirely |
| Personalized ranking (by user history) | Requires user tracking infrastructure |
| External search engine (Typesense, Algolia) | Unnecessary for Phase 1 scale |

---

*Governed by master-architecture.md. All conflicts resolved by that document.*

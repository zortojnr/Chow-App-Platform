# Chow Here — Search System Track

**Status:** AUTHORITATIVE BLUEPRINT  
**Version:** 1.0  
**Last Updated:** 2026-05-27  
**Parent Documents:** master-architecture.md, search-architecture.md, backend-standards.md, data-governance.md

---

## 0. PURPOSE

This track defines the complete design of the Search and Discovery System — the mechanism through which users find dishes and restaurants on the platform.

Search is the primary user journey. It is the first thing most users do when they arrive. A user who cannot find what they are looking for does not return. Search quality is a direct measure of platform trust.

This track governs search query design, ranking logic, geo-aware discovery, alias resolution, and the search API. It operationalizes the search infrastructure defined in `search-architecture.md` into a concrete implementation plan.

**This is a blueprint, not implementation code.**

---

## 1. SYSTEM RESPONSIBILITIES

The Search System owns exactly these responsibilities:

| Responsibility | Description |
|---|---|
| Dish search | Full-text + alias + category search on DishTaxonomy |
| Restaurant search | Full-text search on Restaurant name, city, area |
| Dish-to-restaurant resolution | "Who serves this dish near me?" |
| Geo-aware ranking | Rank results by city/area proximity to user's stated location |
| Alias resolution | "Eba" → finds "Garri" and "Garri Ijebu" too |
| Search logging | Anonymous query logging for intelligence gathering |
| Zero-result handling | Graceful degradation, suggestions when no results found |

It does **not** own:
- Restaurant profile pages (owned by Restaurant Listing System)
- User search history display (owned by User Accounts)
- Admin search analytics (read from `SearchLog` by Admin Platform)
- Vector/semantic search (explicitly not Phase 1)

---

## 2. SEARCH ARCHITECTURE OVERVIEW

### 2.1 Technology

Phase 1 search runs entirely on PostgreSQL. There is no Elasticsearch, Algolia, or vector database.

```
PostgreSQL full-text search (tsvector / tsquery)
  + pg_trgm (trigram fuzzy matching)
  + unaccent extension (diacritic handling)
  + Weighted ranking (ts_rank_cd)
  + Partial indexes on APPROVED restaurants only
```

This is the correct choice for Phase 1 because:
- PostgreSQL FTS is production-grade for the expected query volume
- No additional infrastructure to operate
- Can be replaced with Algolia/Typesense if query performance degrades at scale
- The schema is already optimized for this (tsvector columns, GIN indexes, pg_trgm indexes)

### 2.2 Search Query Flow

```
User types query (e.g., "jollof lagos")
  → Client sends: GET /api/v1/search?q=jollof+lagos&city=Lagos
  → Server parses query tokens
  → Query routing:
      → Is it a dish query? → DishSearch
      → Is it a restaurant query? → RestaurantSearch
      → Ambiguous? → Run both, merge results
  → Execute PostgreSQL FTS queries
  → Apply geo filter (city/area)
  → Apply confidence score ranking
  → Return structured results
  → Log query to SearchLog (async, non-blocking)
```

### 2.3 Query Types

| Query Type | Example Input | Resolution |
|---|---|---|
| Dish name | "jollof rice" | FTS on DishTaxonomy + alias matching |
| Dish alias | "party rice" | Alias field in DishTaxonomy → canonical dish |
| Restaurant name | "Mama Titi Kitchen" | FTS on Restaurant.name |
| City qualifier | "suya abuja" | Dish search + city filter |
| Category | "soups in Lagos" | Category filter + city filter |
| Partial/typo | "egussi" | pg_trgm similarity match |

---

## 3. DISH SEARCH

### 3.1 Dish Search Query

The primary dish search runs against `DishTaxonomy`. It resolves the canonical dish and then finds all restaurants that serve it.

**Stage 1 — Find the canonical dish:**

```sql
SELECT 
  d.id,
  d.canonical_name,
  d.category,
  d.aliases,
  ts_rank_cd(d.search_vector, query) AS rank
FROM "DishTaxonomy" d,
  to_tsquery('english', unaccent(:searchQuery)) query
WHERE 
  d.is_active = true
  AND d.search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

**Fallback — Trigram fuzzy match (when FTS finds 0 results):**

```sql
SELECT 
  id,
  canonical_name,
  similarity(canonical_name, :rawQuery) AS sim
FROM "DishTaxonomy"
WHERE 
  is_active = true
  AND similarity(canonical_name, :rawQuery) > 0.3
ORDER BY sim DESC
LIMIT 5;
```

### 3.2 Alias Resolution

Aliases are searched via the `search_vector` (they are indexed at weight B). A search for "eba" matches because "eba" is an alias for "Garri" in the DishTaxonomy seed data.

This means alias resolution is handled automatically by the FTS vector — no separate alias lookup is needed.

### 3.3 Dish-to-Restaurant Resolution

After finding the canonical dish, find all APPROVED restaurants that serve it:

```sql
SELECT 
  r.id,
  r.name,
  r.slug,
  r.city,
  r.area,
  r.price_range,
  r.confidence_score,
  r.thumbnail_url,
  rd.name_as_served,
  rd.price,
  rd.availability_status
FROM "RestaurantDish" rd
JOIN "Restaurant" r ON r.id = rd.restaurant_id
WHERE 
  rd.dish_id = :dishId
  AND rd.deleted_at IS NULL
  AND r.verification_status = 'APPROVED'
  AND r.deleted_at IS NULL
  AND (:city IS NULL OR r.city = :city)
ORDER BY 
  r.confidence_score DESC,
  r.name ASC
LIMIT :limit OFFSET :offset;
```

---

## 4. RESTAURANT SEARCH

### 4.1 Restaurant Name Search

Direct search on restaurant name and location metadata:

```sql
SELECT 
  r.id,
  r.name,
  r.slug,
  r.city,
  r.area,
  r.price_range,
  r.confidence_score,
  r.thumbnail_url,
  ts_rank_cd(r.search_vector, query) AS rank
FROM "Restaurant" r,
  to_tsquery('english', unaccent(:searchQuery)) query
WHERE 
  r.verification_status = 'APPROVED'
  AND r.deleted_at IS NULL
  AND r.search_vector @@ query
  AND (:city IS NULL OR r.city = :city)
ORDER BY rank DESC, r.confidence_score DESC
LIMIT :limit OFFSET :offset;
```

### 4.2 Category Browse

Users can browse restaurants by dish category without a text query:

```sql
SELECT DISTINCT
  r.id,
  r.name,
  r.slug,
  r.city,
  r.confidence_score,
  r.thumbnail_url
FROM "Restaurant" r
JOIN "RestaurantDish" rd ON rd.restaurant_id = r.id
JOIN "DishTaxonomy" d ON d.id = rd.dish_id
WHERE 
  r.verification_status = 'APPROVED'
  AND r.deleted_at IS NULL
  AND d.category = :category
  AND (:city IS NULL OR r.city = :city)
ORDER BY r.confidence_score DESC
LIMIT :limit OFFSET :offset;
```

---

## 5. GEO-AWARE RANKING

### 5.1 Phase 1 Geo Strategy

Phase 1 does not use GPS coordinates or PostGIS. Geo-awareness is implemented using **city and area string matching**.

This is a deliberate constraint — not a limitation. GPS-based proximity requires the user to share their location (friction) and requires accurate coordinate data (which the platform cannot guarantee at launch). City-level filtering is sufficient for the trust-first product goal.

### 5.2 Geo Filter Application

```
User-provided location signal:
  → URL query param: ?city=Lagos
  → If city is provided: filter results to that city
  → If area is also provided (?city=Lagos&area=Lekki): further filter by area
  → If no location provided: no geo filter, return results across all cities

User location context (Phase 1):
  → The user manually selects their city from a dropdown
  → No automatic geolocation in Phase 1
  → The selected city is persisted in user session/cookie
```

### 5.3 City Data

Valid cities are drawn from the `NigerianCities` reference data seeded in the database. Search queries with city values not in this list return an empty result (not an error) — the query is still executed but city filter is ignored.

---

## 6. RESULT RANKING

### 6.1 Ranking Factors

Results are ranked by a combination of:

| Factor | Type | Phase 1 Weight |
|---|---|---|
| FTS relevance score (`ts_rank_cd`) | Query-dependent | Primary sort |
| Confidence score | Data quality signal | Secondary sort (tiebreaker) |
| Dish availability status | Freshness signal | Tertiary (prefer `ALWAYS_AVAILABLE`) |

### 6.2 Ranking Logic (SQL ORDER BY)

```sql
ORDER BY 
  ts_rank_cd(search_vector, query) DESC,
  confidence_score DESC,
  CASE availability_status 
    WHEN 'ALWAYS_AVAILABLE' THEN 1
    WHEN 'SEASONAL' THEN 2
    WHEN 'WEEKEND_ONLY' THEN 3
    WHEN 'ON_ORDER' THEN 4
    WHEN 'UNKNOWN' THEN 5
  END ASC
```

### 6.3 No Paid Ranking in Phase 1

There is no sponsored or paid placement in Phase 1. Every result is ranked by objective data quality signals only. This is a trust decision.

---

## 7. ZERO-RESULT HANDLING

### 7.1 Zero-Result Response

When a search query returns zero results, the API returns:

```json
{
  "success": true,
  "data": {
    "results": [],
    "total": 0,
    "suggestions": [
      "Try removing the city filter",
      "Try a related dish name (e.g., 'Egusi' instead of 'Egusi Soup')"
    ],
    "popularDishes": [ ... ]  // Top 5 dishes by saved count
  },
  "meta": { "query": "...", "city": "..." }
}
```

The `suggestions` are static in Phase 1 — no ML-based "did you mean?" in Phase 1.

### 7.2 Partial-Match Fallback

If FTS returns zero results, the system automatically runs a trigram similarity query (see Section 3.1) and returns fuzzy matches with a `matchType: "fuzzy"` flag in the response.

---

## 8. SEARCH API ENDPOINT DEFINITIONS

### 8.1 GET /api/v1/search

**Purpose:** Universal search endpoint — searches dishes and restaurants  
**Authentication:** None  
**Rate limit:** 60 requests/minute per IP

**Query parameters:**

```
q:       string (required)    — Search query, min 2 chars, max 200 chars
type:    "dishes"|"restaurants"|"all" (default: "all")
city:    string (optional)    — City filter from NigerianCities
area:    string (optional)    — Area filter within city
page:    number (default: 1)
limit:   number (default: 20, max: 20)
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "dishes": [
      {
        "dishId": "uuid",
        "canonicalName": "Jollof Rice",
        "category": "RICE_DISHES",
        "restaurantCount": 14,
        "matchType": "exact" | "alias" | "fuzzy"
      }
    ],
    "restaurants": [
      {
        "id": "uuid",
        "name": "...",
        "slug": "...",
        "city": "Lagos",
        "area": "Lekki",
        "priceRange": "MID",
        "confidenceScore": 0.85,
        "thumbnailUrl": "...",
        "dishesServed": 8
      }
    ],
    "total": 42,
    "suggestions": []
  },
  "meta": {
    "query": "jollof",
    "city": "Lagos",
    "page": 1,
    "limit": 20
  }
}
```

### 8.2 GET /api/v1/search/dishes/:dishId/restaurants

**Purpose:** Get all restaurants serving a specific dish  
**Authentication:** None  
**Query parameters:** `city`, `area`, `page`, `limit`

Returns restaurants serving the specified dish, filtered and ranked per Sections 3.3 and 6.

### 8.3 GET /api/v1/search/dishes

**Purpose:** Browse dish taxonomy by category  
**Authentication:** None  
**Query parameters:** `category`, `page`, `limit`

Returns all active dishes in a category, ordered alphabetically.

### 8.4 GET /api/v1/search/suggestions

**Purpose:** Autocomplete suggestions as user types  
**Authentication:** None  
**Rate limit:** 120 requests/minute per IP  
**Query parameters:** `q` (min 2 chars), `limit` (max 10)

Returns dish canonical names and aliases matching the prefix. Uses pg_trgm prefix matching:

```sql
SELECT canonical_name, 'dish' AS type
FROM "DishTaxonomy"
WHERE is_active = true
  AND canonical_name ILIKE :prefix
ORDER BY canonical_name
LIMIT :limit;
```

---

## 9. SEARCH LOGGING

### 9.1 What Is Logged

Every search query is logged to `SearchLog` (for anonymous queries) or `UserSearchHistory` (for authenticated users).

Logged fields:
```
query:       The raw search string (trimmed, max 200 chars)
city:        The city filter applied (or null)
resultCount: Number of results returned
createdAt:   Timestamp
```

### 9.2 What Is NOT Logged

- User agent strings
- Device fingerprints
- Beyond city, no location data
- Individual restaurant click-throughs (Phase 2)

### 9.3 Logging is Asynchronous

Search logging must never delay the search response. It is written as a fire-and-forget operation **after** the response is sent:

```typescript
// Pattern in search route handler
const results = await searchService.search(params)
const response = buildResponse(results)

// Fire and forget — do not await
searchLogService.log({ query, city, resultCount: results.total }).catch(err => {
  console.error('[SearchLog] Failed to log query:', err)
})

return response
```

### 9.4 Log Retention

Search logs are retained for 90 days and then purged. Admin analytics use aggregated views, not raw logs.

---

## 10. MODULE STRUCTURE

```
features/search/
├── services/
│   ├── search.service.ts           ← Orchestrator (routes to dish/restaurant search)
│   ├── dish-search.service.ts      ← Dish FTS + alias resolution + fallback
│   ├── restaurant-search.service.ts← Restaurant FTS
│   ├── dish-restaurant.service.ts  ← Dish → restaurants resolution
│   ├── suggestion.service.ts       ← Autocomplete prefix queries
│   └── search-log.service.ts       ← Log writing (async)
├── schemas/
│   └── search.schema.ts            ← Zod: query params validation
├── hooks/
│   ├── useSearch.ts                ← Main search hook
│   └── useSearchSuggestions.ts     ← Autocomplete hook (debounced)
├── components/
│   ├── SearchBar.tsx               ← Main search input with suggestions
│   ├── SearchResults.tsx           ← Results display
│   ├── DishResultCard.tsx
│   ├── RestaurantResultCard.tsx
│   └── ZeroResults.tsx
└── types/
    └── search.types.ts
```

---

## 11. SEARCH QUERY CONSTRUCTION RULES

### 11.1 Input Sanitization

Before any query is sent to PostgreSQL:

1. Trim whitespace
2. Remove SQL injection attack vectors (Prisma parameterization handles this, but explicit awareness required)
3. Truncate to 200 characters
4. Strip special characters that break `to_tsquery`: `! ' & | < > ( )`

### 11.2 Query Tokenization

Multi-word queries are converted to tsquery format:

```
"jollof rice"    → to_tsquery('english', 'jollof & rice')
"lagos suya"     → to_tsquery('english', 'lagos & suya')
```

Prefix search uses `websearch_to_tsquery` for more natural language handling:

```sql
websearch_to_tsquery('english', unaccent(:rawQuery))
```

`websearch_to_tsquery` handles natural language input more gracefully than `to_tsquery` and is preferred for user-generated queries.

### 11.3 Query Failure Safety

If `to_tsquery` or `websearch_to_tsquery` throws a PostgreSQL error (malformed query), catch the error and fall back to the trigram similarity search. Never return a 500 for a malformed search query — return an empty result set with suggestions.

---

## 12. PERFORMANCE CONSTRAINTS

### 12.1 Query Timeout

All search queries have a maximum execution time of **500ms**. If a query exceeds this, it is cancelled and the system returns an empty result with a `timeout` error flag.

```typescript
await db.$executeRaw`SET statement_timeout = '500ms'`
```

This is set per-connection in the search service, not globally.

### 12.2 Connection Pooling

The Prisma client is a singleton. No per-request DB connections. Railway managed PostgreSQL handles connection pooling at the infrastructure level.

### 12.3 Index Dependency

Search performance is entirely dependent on the GIN indexes defined in `database-track.md`. If those indexes do not exist, queries will fall back to sequential scans and will be unacceptably slow. Index existence must be verified after every migration.

---

## 13. SEO INTEGRATION

### 13.1 Search-Driven SEO Pages

The search system generates data for the following SEO-critical page types:

| Page | URL Pattern | Data Source |
|---|---|---|
| Dish discovery page | `/dishes/[dish-slug]` | DishTaxonomy + dish-restaurant resolver |
| Restaurant by city | `/[city]/restaurants` | Restaurant search, city filter |
| Dish in city | `/[city]/[dish-slug]` | Dish-restaurant resolver, city filter |

These pages are pre-rendered via Next.js Static Site Generation (SSG) using `generateStaticParams`. The search service provides the data; the page layer handles rendering.

### 13.2 Structured Data

Search result pages include JSON-LD structured data (Restaurant and FoodEstablishment schema). This is generated by the restaurant listing system using data surfaced by search queries.

---

## 14. IMPLEMENTATION SEQUENCE

### Step 1: Query Infrastructure
1. Verify all GIN indexes exist (from database-track.md migrations)
2. Verify FTS triggers are firing and `search_vector` columns are populated
3. Test raw SQL queries in psql against seeded data

### Step 2: Dish Search Service
1. Write `dish-search.service.ts`
2. Implement FTS query + fallback trigram
3. Write unit tests with seed data fixtures

### Step 3: Restaurant Search Service
1. Write `restaurant-search.service.ts`
2. Implement FTS + city filter
3. Write unit tests

### Step 4: Dish-to-Restaurant Resolution
1. Write `dish-restaurant.service.ts`
2. Implement ranked restaurant list for a given dish
3. Write unit tests

### Step 5: Search Orchestrator
1. Write `search.service.ts`
2. Wire dish and restaurant search
3. Implement zero-result handling and suggestions

### Step 6: Autocomplete
1. Write `suggestion.service.ts`
2. Implement prefix match query
3. Wire to debounced hook

### Step 7: Search Logging
1. Write `search-log.service.ts`
2. Implement fire-and-forget logging
3. Verify logs appear in DB without blocking response

### Step 8: API Endpoints
1. Implement all search endpoints
2. Validate query params with Zod
3. Integration tests

### Step 9: UI (After API complete)
1. `SearchBar` with autocomplete
2. `SearchResults` page with dish and restaurant sections
3. `ZeroResults` with suggestions

---

## 15. KNOWN RISKS AND EDGE CASES

| Risk | Mitigation |
|---|---|
| `to_tsquery` throws on special characters | Catch error, fall back to trigram search, never return 500 |
| FTS indexes not populated for new restaurants | FTS trigger fires on INSERT/UPDATE — verify trigger exists in migration 010 |
| Search returns DRAFT/PENDING restaurants | All search queries filter on `verification_status = 'APPROVED'` explicitly |
| Deleted restaurants appear in results | All queries filter `deleted_at IS NULL` via Prisma soft-delete extension |
| City filter typos (e.g., "lagoss") | City param validated against NigerianCities enum; typos simply ignored (no city filter applied) |
| High autocomplete request volume | Suggestions endpoint has 120 req/min rate limit; results can be cached client-side for 30s |
| Empty query string submitted | Zod validates `q` as min 2 characters; empty or single-character queries return 422 |
| Search query with only stopwords | `websearch_to_tsquery` handles gracefully; returns empty result |

---

*Governed by master-architecture.md and search-architecture.md. All conflicts resolved by those documents.*

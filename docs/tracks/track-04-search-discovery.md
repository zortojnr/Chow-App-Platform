# Chow Here — Track 4: Search and Discovery System

**Status:** SPECIFICATION — approved  
**Version:** 1.1  
**Date:** 2026-06-06  
**Governed By:** master-architecture.md · chow-here-design-system-v1.md · search-system-track.md  
**Depends On:** Track 3 (Restaurant Listing System) — complete  
**Next Track:** Track 5 — User Accounts

---

## 0. PURPOSE OF THIS DOCUMENT

This document is the authoritative architecture and product specification for the Chow Here Search and Discovery System (Track 4). It defines what is to be built, why, within what constraints, and in what sequence.

**The goal of Track 4 is not merely search.**

Search is the mechanism. The goal is user retention — making Chow Here the first place users go when they think about Nigerian food. A user who finds a dish once may have come from Google. A user who returns three times is developing a habit. A user who saves dishes and checks their list before going out on Friday is a retained user.

Track 4 must serve two questions simultaneously:

- "Where can I get Jollof Rice in Lekki?" — intentional search
- "What should I eat this weekend?" — ambient discovery

Both questions, answered well, create a reason to return.

### Governing Product Principle

> **Every major home page section must help a user discover a dish they did not arrive looking for.**

This principle is architecture-level law for Track 4. It is not a design preference. It governs every home page section decision, every discovery component, and every API endpoint that feeds the home page.

Its implications:

- **Dishes are the entry point. Restaurants are the answer.** The home page surfaces dish names, dish categories, and dish discovery signals — not restaurant names. A restaurant appears on the home page only as context for a dish it serves.
- **No restaurant-first layouts on the home page.** A grid of restaurant cards with no dish context is a directory, not a discovery platform.
- **Discovery sections serve the exploratory user.** Someone with no specific dish in mind must leave the home page having thought of something they want to eat. The home page fails if it requires the user to already know what they want.
- **Future neighborhood-level discovery must be possible.** The architecture must support progressively narrowing from city → area → neighborhood as location data improves. Phase 1 uses city-level granularity. The service interfaces are designed for finer granularity from the start.

---

## 1. PRODUCT OBJECTIVES

### 1.1 Primary Objectives

| ID | Objective | Rationale |
|---|---|---|
| BO-1 | Deliver search responses under 200ms that feel instantaneous | Speed is a trust signal — slow search communicates platform uncertainty |
| BO-2 | Surface dish-first discovery on the home page for users without a specific search intent | Retention requires value without prior intent |
| BO-3 | Integrate the save interaction into search results, creating a personal layer before Track 5 is complete | The save action is the primary retention hook from search |
| BO-4 | Build SEO landing pages that compound organic traffic for every verified dish-city combination | Each verified listing is a permanent SEO asset; the more listings, the more surface area |
| BO-5 | Preserve every architectural decision for future geo-aware distance ranking and in-product navigation | Phase 2 navigation must not require reworking Phase 1 search structures |

### 1.2 Explicit Non-Objectives

The following must not appear in Track 4:

- User reviews or star ratings
- Restaurant-to-restaurant comparison features
- AI or vector-based semantic search (Phase 2+)
- Real-time dish availability updates beyond what is stored in the database
- Delivery or ordering signals
- GPS-based distance sorting (Phase 2 — requires `latitude`/`longitude` schema additions)
- The `/dashboard/saved` listing page (Track 5)
- Paid or sponsored placement of any kind

---

## 2. USER GOALS AND RETURN VISIT ARCHITECTURE

### 2.1 The Three User States

Users arrive at Chow Here in one of three states. Track 4 must serve all three.

| State | What They Know | What They Need |
|---|---|---|
| **Intentional** | A specific dish ("I want Efo Riro in Lekki") | Fast, accurate search with verified results |
| **Exploratory** | Hungry but undecided ("Something Nigerian, not sure what") | Discovery: category browse, popular dishes, featured restaurants |
| **Returning** | Has been here before ("I want that place I found last time") | Quick re-access via saved dishes and search history |

Tracks 1–3 serve intentional users well. Track 4 must serve all three — the returning state is the most valuable for building habit.

### 2.2 The Five Return Visit Loops

These are the behavioral loops that create habit. Each is a reason to return.

**Loop 1 — Dish Discovery**
```
User searches for a dish → finds a verified restaurant → visits and eats
  → Returns next time to find it again, or a different option
Retention signal: repeat search for the same dish over time
```

**Loop 2 — Saved Dish Access**
```
User finds a dish they love, saves the specific dish-restaurant pair
  → Returns next weekend to access what they saved
  → May compare other restaurants serving the same dish
Retention signal: access to the saved dishes list
```

**Loop 3 — Ambient Discovery**
```
User visits with no specific dish in mind
  → Sees "Popular in Lagos this week" on the home page
  → Clicks through to a dish they didn't know to search for
  → Creates a new intentional search in that session
Retention signal: home page visit that converts to a search
```

**Loop 4 — Search History Continuity**
```
User returns, types in the search bar
  → Sees their last searches in the idle-state dropdown
  → Instantly re-runs a past search without retyping
Retention signal: history re-use reducing friction on return visits
```

**Loop 5 — Trust Deepening Over Time**
```
Platform adds verified restaurants and dishes continuously
  → A search that returned 4 results last month now returns 9
  → The user updates their mental model of the platform's quality
Retention signal: return visit motivated by expected platform improvement
```

Loops 1–3 are primary and are fully addressed in Track 4. Loops 4–5 are seeded in Track 4 (data written) and surfaced in Track 5 (personalized UI).

---

## 3. SEARCH ARCHITECTURE

### 3.1 Technology (Confirmed from search-system-track.md)

Track 4 implements the search architecture defined in `search-system-track.md` exactly. No deviations. The technology stack is:

```
PostgreSQL full-text search (tsvector / tsquery via websearch_to_tsquery)
  + pg_trgm (trigram similarity for fuzzy fallback)
  + unaccent extension (diacritic handling for Nigerian dish names)
  + GIN indexes (created in database-track.md migrations)
  + Weighted ranking (ts_rank_cd)
```

There is no Elasticsearch, Algolia, or external search provider in Phase 1. This is a deliberate choice: PostgreSQL is sufficient for Phase 1 query volume and eliminates operational and billing complexity.

### 3.2 Query Flow

```
User types query
  → Debounced at 150ms → suggestion.service.ts (autocomplete)
  → On submit (Enter key or search button tap) → search.service.ts
      → Query routing: dish? restaurant? ambiguous?
      → PostgreSQL FTS query (websearch_to_tsquery + unaccent)
      → Geo filter: city (from session cookie), area (optional query param)
      → Ranking formula applied (§5.1)
      → Zero-result fallback: pg_trgm similarity search if FTS returns nothing
      → Response returned to client
  → After response sent: fire-and-forget log to SearchLog / UserSearchHistory (async)
```

### 3.3 Search Input Context

The search bar operates in two modes.

**Idle mode** (focused with no typed text):
- Placeholder: "Search for a dish..." — not "Search restaurants"
- If authenticated and UserSearchHistory is populated: shows last 5 searches
- If anonymous or no history: shows top 5 popular dishes from SearchLog (by location)
- City context indicator visible beside or below the input

**Active mode** (typing, ≥ 2 characters):
- Autocomplete suggestions appear: dish names + category badges
- Suggestions from `suggestion.service.ts` — prefix match on canonical names and aliases
- Maximum 8 suggestions (not 10 — reduces visual noise)
- Selecting a suggestion submits the search immediately

### 3.4 City Context Persistence

The active city is a first-class piece of search context.

- Stored in a session cookie: `chow-city`, `SameSite=Lax`, `max-age=7776000` (90 days)
- Contains only a city name ("Lagos") — no personal data
- Default: no city filter until user selects one (nationwide search)
- Surfaced as: "Showing results in Lagos ▾" — a dropdown to change, not buried in settings
- City options sourced from `NigerianCities` enum (already seeded)
- On city change: if a search query is active, re-run it immediately

City is **not** auto-detected from GPS in Phase 1. Manual selection is the correct Phase 1 approach.

---

## 4. DISCOVERY ARCHITECTURE

Discovery answers the question users have not yet asked. It is the product's ambient intelligence layer.

### 4.1 Home Page Structure

The home page is the discovery entry point. It is not a marketing page and it is not a restaurant directory. Every section answers the question: "What dish might this person want to try that they have not yet thought of?"

**The test for every section:** Remove it. If the page is no worse at helping users discover a new dish, the section does not belong.

**Structure (mobile-first, scrolling):**

---

**Section 1 — Search Hero**

The search bar is the primary action. Dish discovery starts here.

- Chow Here wordmark: Fraunces, `text-4xl`, `amber-500`
- Search bar: full-width, hero prominence (56px desktop, 52px mobile, per §10.1)
- Placeholder: "Search for a dish..." — never "Search restaurants"
- City selector: "Showing results in Lagos ▾" — `text-sm`, `neutral-600`, immediately below the search bar
- Tagline: "Find verified Nigerian restaurants, dish by dish." — Fraunces, `text-xl`, `neutral-700`
- This is the only marketing copy on this page

---

**Section 2 — Category Chips**

Dishes exist in categories. This section invites users to browse by category — a dish-level entry point, not a restaurant-level one.

- Section label: "What are you in the mood for?" — Plus Jakarta Sans, `text-xs`, `font-medium`, `neutral-500`, uppercase, tracked at `+0.08em`
- Horizontal scrollable row of all 9 `DishCategory` values as named chips
- Chip display names (human-readable, not enum values):

| Enum | Display Label |
|---|---|
| `RICE_DISHES` | Rice |
| `SOUPS` | Soups |
| `SWALLOW` | Swallow |
| `STREET_FOOD` | Street Food |
| `PROTEIN` | Protein |
| `BREAKFAST` | Breakfast |
| `DRINKS` | Drinks |
| `SNACKS` | Snacks |
| `DESSERTS` | Desserts |

- Chip style: `radius-full`, `amber-50` fill, `amber-700` text, `text-sm`, `font-medium`, `12px 16px` padding
- Tapping navigates to `/category/[category-slug]`
- No "active" chip state on the home page — all chips are equal entry points

---

**Section 3 — Popular Dishes**

What are people eating in this city? This section surfaces real user demand — dish names people are searching for.

- Section heading: "Popular in [City]" (if city set) or "Popular right now" — Fraunces, `text-2xl`, `neutral-800`
- Data source: Top 8 dishes from `SearchLog` (30-day window), matched to active `DishTaxonomy` entries
- Fallback when SearchLog has fewer than 4 matching dishes: top 8 from `DishTaxonomy` ordered by `canonicalName`
- Rendered as `DishDiscoveryTile` components (see §4.5 for spec)
- Each tile: dish canonical name + category badge + "N restaurants" count
- Tapping navigates to `/dishes/[dish-slug]?city=[city]`
- This section is **dish names only** — no restaurant names appear

---

**Section 4 — Trending This Week**

What's gaining momentum right now — not just what's consistently popular, but what people are searching for with increasing frequency this week. This section feels alive and current; it changes faster than Section 3.

- Section heading: "Trending this week" — Fraunces, `text-2xl`, `neutral-800`
- Data source: Top 8 dishes from `SearchLog` (7-day window), matched to active `DishTaxonomy` entries
- Deduplication: if a dish appears in both Popular (§3) and Trending (§4), it is removed from the Trending section (show different dishes in each section)
- Fallback when fewer than 4 non-duplicate trending dishes: section is omitted entirely
- Rendered as `DishDiscoveryTile` components — same as Section 3 but labeled differently
- The 7-day window is tighter: this is what people searched yesterday and today
- This section is **dish names only** — no restaurant names appear

---

**Section 5 — Just Verified**

New food intelligence has arrived. An admin just confirmed these dishes at these restaurants. This section shows recently verified `RestaurantDish` records — not recently added restaurants.

**This section is dish-first.** The dish is the headline. The restaurant is the supporting context.

- Section heading: "Just verified" — Fraunces, `text-2xl`, `neutral-800`
- Sub-label: "New dishes confirmed by our team" — `text-sm`, `neutral-500`
- Data source: 6 most recently verified `RestaurantDish` records (`verifiedAt DESC`) in the active city, from `APPROVED` restaurants
- Rendered as `DishDiscoveryCard` components (see §4.5 for spec)
- Each card: dish name (hero) + restaurant name (context) + area + availability badge
- If no recently verified dishes in the active city: section is omitted (not shown with an empty state)
- "Explore all dishes →" link navigates to `/category/` (category browse landing)
- This section is **dish-first** — the dish name is the large text; the restaurant name is smaller, secondary text

---

**Section 6 — Platform CTA**

- "Submit a restaurant" — ghost link, `text-sm`, `neutral-600`
- Positioned at the bottom, below all discovery sections
- This is not a primary CTA — it is a growth mechanism for contributors, positioned where it does not interrupt discovery

### 4.2 Category Browse Pages

**Route:** `/category/[category-slug]`

Shows all verified restaurants that serve at least one dish in the named category, filtered by the active city.

**URL examples:**
- `/category/soups` — all verified restaurants serving soups (nationwide if no city)
- `/category/soups?city=Lagos` — scoped to Lagos

**Page structure:**
- Heading: "[Category Name] in [City]" or "[Category Name]" if no city — Fraunces, `text-4xl`, `neutral-900`
- Category description: a short seeded description per `DishCategory` value (defined in a static config object, not in the database)
- City filter tabs: if more than one city has restaurants in this category, show tabs (same pattern as `/restaurants` from Track 3)
- Restaurant card grid: 2-col mobile, 3-col tablet, 4-col desktop — uses `RestaurantCard` from Track 3
- Empty state if none: "No verified restaurants in this category yet." + "Submit a restaurant" CTA

**Pre-rendering:** ISR via `generateStaticParams()` across all 9 `DishCategory` values. `revalidate: 3600` (1 hour). Indexable.

**SEO title:** "[Category Name] Restaurants in [City] — Verified Nigerian Food | Chow Here"

### 4.3 Dish Landing Pages (SEO Primary Assets)

These are the most SEO-valuable pages in the product. They are pre-rendered, stable, and indexable — not search result pages.

**Route:** `/dishes/[dish-slug]`

**Purpose:** A user who searches Google for "where to eat egusi soup in Lagos" should land on `/dishes/egusi-soup?city=Lagos` and see all verified restaurants serving Egusi Soup in Lagos.

**Page structure:**
- Heading: "Where to eat [Dish Canonical Name]" — Fraunces, `text-4xl`, `neutral-900`
- Aliases shown inline: "Also known as: Egushi, Egwusi" — `text-sm`, `neutral-500`, italic
- Dish description: from `DishTaxonomy.description` if populated; omitted if null
- City filter tabs (if multiple cities have verified results for this dish)
- Restaurant card grid: uses `SearchRestaurantCard` with the matched dish in context
- Empty state per city: "No verified restaurants serve [Dish] in [City] yet." + "Submit a restaurant"
- `revalidate: 1800` (30-minute ISR)

**`generateStaticParams()`:** Pre-renders all active dishes at build time. New dishes added by admin are picked up at the next ISR interval.

**Note on dish slugs:** `DishTaxonomy` does not currently have a `slug` field. **A schema migration is required before Step 17 (dish landing pages) can be built.** See §16 Step 0 for the migration specification.

### 4.5 DishDiscoveryTile and DishDiscoveryCard — Specifications

These are the two dish-first discovery components used on the home page. They are distinct from `DishResultTile` (used in search results) and `DishCard` (used on the restaurant profile page).

**DishDiscoveryTile** — for section grids (Popular Dishes, Trending This Week)

```
Layout: vertical card
Surface: neutral-0
Radius: radius-xl (16px)
Shadow: shadow-sm (resting), shadow-DEFAULT (hovered)
Hover: translateY(-2px), 200ms ease-out (DS §7.4)
Padding: space-5 (20px)
Min width: 140px (mobile), 160px (tablet+)
```

Structure (top to bottom):
1. Category icon or dish category color block — 48px × 48px, `radius-lg`, `amber-100` background, amber food icon (Lucide `UtensilsCrossed` or category-specific icon), centered
2. Dish canonical name — Plus Jakarta Sans, `text-base`, `font-semibold`, `neutral-900`, max 2 lines, `line-clamp-2`
3. Category badge — `text-xs`, `neutral-100` fill, `neutral-700` text (per DS §10.4 category badge)
4. Restaurant count — `text-xs`, `neutral-500`: "N restaurants"

Skeleton: 48px icon placeholder + 2 text line placeholders + 1 badge placeholder

**DishDiscoveryCard** — for the "Just Verified" section (dish-at-restaurant)

```
Layout: horizontal card (dish name left, meta right)
Surface: neutral-0
Radius: radius-xl (16px)
Shadow: shadow-sm (resting), shadow-DEFAULT (hovered)
Hover: translateY(-2px), 200ms ease-out (DS §7.4)
Padding: space-5 (20px)
Full width on mobile, max 420px on desktop
```

Structure:
1. **Left: Dish identity**
   - Dish canonical name — Fraunces, `text-xl`, `font-semibold`, `neutral-900`
   - Restaurant name — Plus Jakarta Sans, `text-sm`, `font-normal`, `neutral-600` — "at [Restaurant Name]"
   - Area — `text-xs`, `neutral-500` (e.g., "Lekki Phase 1")

2. **Right: Status**
   - Availability badge: `DishAvailabilityStatus` pill (amber for `ALWAYS_AVAILABLE`, neutral for others)
   - Verified indicator: Lucide `ShieldCheck`, 16px, `green-500` — "Confirmed"

3. **Bottom row:**
   - Price if known: `text-sm`, `amber-700`, `font-semibold` — "₦2,500"
   - Category badge

Navigation: tapping navigates to the **dish landing page** (`/dishes/[dish-slug]?city=[city]`), not the restaurant profile. The user arrived at this card via dish discovery; dish landing page continues the dish-first journey.

Skeleton: two text line placeholders (left) + badge placeholder (right)

**Governing rule for both components:** The dish name is always the largest text. The restaurant name is always smaller. If this hierarchy is inverted in any implementation, the component is non-compliant.

### 4.6 Trending Dishes — Query Design

The Trending section uses a 7-day window to surface momentum rather than consistency.

```sql
SELECT
  LOWER(TRIM(query)) AS normalized_query,
  COUNT(*) AS search_count,
  COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '3 days') AS recent_count
FROM "SearchLog"
WHERE
  location = :location
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY normalized_query
ORDER BY
  -- Weight recent searches more heavily to detect acceleration
  (COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '3 days') * 2.0
   + COUNT(*)) DESC
LIMIT 20;
```

Post-processing (same as Popular Dishes, §4.4):
1. Normalize and match against `DishTaxonomy`
2. Remove any dishes already in the Popular Dishes result set (no duplication between sections)
3. If fewer than 4 unique dishes remain after deduplication: section is omitted
4. Return top 8

The acceleration weight (`recent_count * 2.0`) means a dish searched 10 times in the last 3 days ranks above one searched 15 times spread over 7 days. This creates a genuine "trending" signal rather than just a shorter-window popularity signal.

### 4.7 Neighborhood-Level Discovery Architecture

The governing principle requires that future neighborhood-level discovery is architecturally possible. This section defines the design decisions that preserve that path.

**Phase 1 granularity:** City-level only. `SearchLog.location` stores the city name ("Lagos"). `discovery.service.ts` accepts `{ location: string | null }`.

**Phase 2 granularity:** Area-level. `SearchLog` receives an additional `area` field via migration (nullable). `discovery.service.ts` interface changes to `{ city: string | null, area: string | null }` — a non-breaking extension.

**Phase 3 granularity:** GPS-level (post lat/lng schema addition). Discovery services can rank results by distance when coordinates are available.

**Architecture decisions that preserve this path:**

1. **Service interface uses named parameters, not positional:** `getPopularDishes({ city, area, window })` — not `getPopularDishes(city, window)`. Adding `area` to the signature is non-breaking.

2. **API accepts `area` query param now, even though it has no effect in Phase 1.** The param is parsed and passed through; it is silently ignored when `SearchLog.area` does not exist. This prevents a breaking API change in Phase 2.

3. **`SearchLog.location` stores city only, not compound strings.** Do not store "Lagos/Lekki" as a single field. When Phase 2 adds area, it adds a separate `area` column — not a parsing change to an existing field.

4. **`DishDiscoveryCard` always shows `area` when available.** In Phase 1, `RestaurantDish` has the restaurant's `area` field available. The component already surfaces it. In Phase 2, area becomes a discoverable filter — the component renders it as a tappable filter, not just a label.

5. **Discovery API responses always include `area` on restaurant context fields.** Even in Phase 1 where area is not a filter, the API returns it. Clients can display it and eventually filter by it without an API change.

### 4.9 The Popular Dishes Signal

The "Popular in [City]" section is computed from real user behavior. This is the organic feedback loop:

```sql
SELECT
  LOWER(TRIM(query)) AS normalized_query,
  COUNT(*) AS search_count
FROM "SearchLog"
WHERE
  location = :city
  AND "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY normalized_query
ORDER BY search_count DESC
LIMIT 20;
```

Post-processing before display:
1. Normalize: trim whitespace, lowercase
2. Match against `DishTaxonomy.canonicalName` (exact) and `DishTaxonomy.aliases` (ILIKE)
3. Keep only queries that resolve to a real, active dish
4. If fewer than 4 dishes match: pad with seeded fallback (top dishes by alphabetical order)
5. Return top 8 after matching

Results are cached at the API layer for 60 seconds minimum (Next.js `unstable_cache`).

**The compounding effect:** Week 1 of launch, popular dishes shows seeded fallback data. By month 3, with real search volume, it reflects genuine user demand by city. The user who returns weekly sees a home page that has evolved — a signal that the platform is alive.

---

## 5. SEARCH RANKING — AUTHORITATIVE FORMULA

### 5.1 Resolving the Ranking Formula

`search-system-track.md` and `restaurant-listing-track.md` contain slightly different ranking descriptions. This section is the authoritative resolution for Track 4 implementation.

**Ranking formula for dish-to-restaurant results:**

```
display_score = (
  fts_relevance    * 0.40   -- primary: how well does this match the query?
  confidence_score * 0.35   -- secondary: how verified is this restaurant?
  availability     * 0.15   -- tertiary: is the dish actually available?
  recency          * 0.10   -- quaternary: is the listing recent?
)
```

**SQL implementation:**

```sql
ORDER BY (
  ts_rank_cd(r.search_vector, query) * 0.40
  + r.confidence_score * 0.35
  + CASE rd.availability_status
      WHEN 'ALWAYS_AVAILABLE' THEN 0.15
      WHEN 'WEEKEND_ONLY'     THEN 0.10
      WHEN 'SEASONAL'         THEN 0.08
      WHEN 'ON_ORDER'         THEN 0.05
      WHEN 'UNKNOWN'          THEN 0.00
    END
  + CASE
      WHEN r."approvedAt" > NOW() - INTERVAL '30 days'  THEN 0.10
      WHEN r."approvedAt" > NOW() - INTERVAL '90 days'  THEN 0.05
      ELSE 0.00
    END
) DESC
```

### 5.2 Ranking Principles

**FTS relevance is never overridden by trust score alone.** A restaurant that perfectly matches "Efo Riro" ranks above a higher-confidence restaurant that serves a tangentially related dish.

**Confidence score is the tiebreaker.** When FTS scores are equal — common when many restaurants serve the same popular dish — the more thoroughly verified restaurant rises.

**Availability is a user utility signal, not a trust signal.** A restaurant that always has the dish is ranked above one where availability is unknown. This reflects real usefulness to the user, not platform quality.

**Recency rewards maintained platforms.** Newly verified restaurants surface above older listings when FTS and confidence are comparable. This creates an incentive for admins to continuously approve new listings.

### 5.3 No Paid Ranking

There is no sponsored or paid placement. Every result is ranked by objective signals only. This must not be reversed under any circumstances in Phase 1. Trust is the product.

---

## 6. TRUST SIGNAL PLACEMENT

Trust signals are quiet, present, and specific. They are not decorations.

### 6.1 On Search Result Cards

| Signal | Placement | Visual Treatment |
|---|---|---|
| Verified badge | Overlaid on photo, bottom-left | Green pill, "Verified", `text-xs`, `font-semibold`, per DS §10.4 |
| Dish availability | Below restaurant name | `DishAvailabilityStatus` — amber pill for `ALWAYS_AVAILABLE`, neutral for others |
| Price range | Bottom of card | ₦ / ₦₦ / ₦₦₦ badge per DS §10.4 |
| Matched dish context | Below restaurant name | "[Dish as served]" in `text-sm`, `neutral-600` |

The confidence score numeric value never appears. The score band label never appears on result cards. The verified badge is the only trust signal at this granularity.

### 6.2 On Dish Result Tiles

When search returns dish tiles (before expanding to restaurant list), each dish tile shows:

```
[Canonical Dish Name]              [Category Badge]
[N] verified restaurants in [City]
```

"N verified restaurants" is a trust signal by inference: multiple admins independently confirmed multiple restaurants serve this dish. The number communicates coverage.

### 6.3 On Zero Results

Per design system §15.2:

```
Headline: "No results for "[query]""
Body:     "We haven't verified a restaurant serving this dish in [city] yet."
CTA 1:    "Submit a restaurant" → /submit
CTA 2:    "Search in all cities" → removes the city filter and re-runs the query
```

The phrase "verified" is the trust signal. It tells the user: results exist elsewhere; this city hasn't been covered yet. It is honest. It does not imply the dish doesn't exist — only that the platform hasn't confirmed it here.

### 6.4 On the Idle Search State

When a user arrives at `/search` without a query:
- Show "Popular searches" from the discovery service (same data as the home page section)
- Show category chips for browse
- No restaurant cards visible until a query is submitted
- This is not a search results page — it is an invitation to search

---

## 7. SAVED DISHES STRATEGY

### 7.1 The Dish-First Save Model

Chow Here saves `RestaurantDish` records — specific dish-at-restaurant pairs — not restaurants in general. The `SavedDish` schema (`userId`, `restaurantDishId`) enforces this correctly.

**Why this model is correct:**

A user who saves "Mama Titi's Kitchen" has no context for why they saved it a month later. A user who saves "Jollof Rice at Mama Titi's Kitchen, Lekki" knows exactly why. The dish-first save creates a memory, not a bookmark.

This also enables future discovery: "Other restaurants serving Jollof Rice near you that you haven't saved yet." The save data becomes a dish preference signal.

### 7.2 What the Save Action Requires

To save a dish from a search result, the UI needs the `RestaurantDish.id` — the junction table record for that specific dish at that specific restaurant. This means:

**The search API response for restaurant results must include `restaurantDishId` when the result is in the context of a dish query.** This field is not currently in the `search-system-track.md` response shape. Track 4 adds it.

Updated search result shape (restaurant card in dish query context):

```typescript
interface SearchRestaurantResult {
  id: string
  name: string
  slug: string
  city: string
  area: string | null
  priceRange: PriceRange
  confidenceScoreBand: 'EXCELLENT' | 'STRONG' | 'VERIFIED'
  thumbnailUrl: string | null
  dishesServed: number
  // Dish-specific context (present when result is from a dish query):
  matchedDish: {
    restaurantDishId: string  // The RestaurantDish.id — needed for the save action
    nameAsServed: string | null
    availabilityStatus: DishAvailabilityStatus
    price: string | null
  } | null
  // Phase 2 navigation placeholder:
  distanceKm: null  // Always null in Phase 1
}
```

### 7.3 The Save Interaction Design

Track 4 builds the save UI on search result cards. Track 5 builds the `/dashboard/saved` listing page.

**Visual:**
- Lucide `Bookmark` icon, 20px, positioned top-right of the `SearchRestaurantCard`
- Unsaved: outline style, `neutral-400`
- Saved: filled, `amber-500`
- Touch target: 40×40px minimum (DS §8.5)

**Interaction flow:**

```
User taps Bookmark
  → If not authenticated: toast "Sign in to save dishes", then redirect to
    /login?callbackUrl=[current page]
  → If authenticated:
      → Optimistic update: icon fills amber-500 immediately (no network wait)
      → POST /api/v1/users/saved-dishes { restaurantDishId }
      → On success: state confirmed, toast "Saved" (green, Lucide CheckCircle)
      → On error: revert icon, toast "Could not save — please try again" (error)
  → Second tap (unsave):
      → Optimistic revert: icon becomes outline immediately
      → DELETE /api/v1/users/saved-dishes/:savedDishId
      → On error: revert, toast error
```

Icon transition: `200ms ease-spring` (the spring easing communicates a "snap" — an action that has landed).

### 7.4 API Contract for Save (Track 4 defines; Track 5 implements)

```
POST /api/v1/users/saved-dishes
Auth: USER, ADMIN, SUPER
Body: { restaurantDishId: string }
Response 201: { id: string }  // the SavedDish.id for future deletion
Response 409: already saved (idempotent: treat as success in UI)

DELETE /api/v1/users/saved-dishes/:savedDishId
Auth: USER, ADMIN, SUPER
Response 204: no content

GET /api/v1/users/saved-dishes
Auth: USER, ADMIN, SUPER
Query: page, limit, city (optional)
Response 200: paginated SavedDish list with restaurant and dish context
```

### 7.5 Saved State Management

The save state must be visible across all pages in a session without repeated API calls.

The `useSavedDish` hook maintains a Zustand `savedDishIds: Set<string>` store (keyed by `restaurantDishId`) that:
- Is populated on authenticated session start from `GET /api/v1/users/saved-dishes` (returns all IDs — a single lightweight request)
- Receives optimistic updates on each save/unsave
- Is consulted by every `SearchRestaurantCard` to set the initial bookmark state

In Phase 1 (before Track 5), this store is a stub: it tracks saves in memory for the session but has no API backing until Track 5 builds the save endpoints. The UI works correctly; the data is lost on page reload until Track 5 is complete.

---

## 8. CONSUMER RETENTION ARCHITECTURE

### 8.1 Search History (UserSearchHistory)

The `UserSearchHistory` model exists. Track 4 writes to it and surfaces it in the search bar's idle state.

**Written after every authenticated search:**
```typescript
{
  userId: string,
  query: string,      // trimmed, max 200 chars
  location: string | null,  // city value at time of search (matches UserSearchHistory.location field)
  createdAt: Date
}
```

Note: The field is `UserSearchHistory.location`, not `.city`. All Track 4 code must use `location`.

**Surfaced in the search bar (authenticated users):**
- Focus search bar with no text → show last 5 records from `UserSearchHistory`
- Each item shows: query string + location context (if set)
- Tapping re-runs the search (fills input + triggers submission)
- "× Clear history" ghost button at the bottom of the list clears `UserSearchHistory` for this user
- History is authenticated-only. Anonymous users see popular searches from `SearchLog` instead.

### 8.2 Anonymous Popular Searches

For anonymous users, the search bar idle state shows popular searches from `SearchLog.query` aggregated by `location` and `createdAt`. The same data as the "Popular in [City]" home page section — one source, two surfaces.

This gives anonymous users context without requiring login. It also communicates platform activity: real searches, by real users, surfaced as suggestions.

### 8.3 Persistent City Context

City persists across sessions via the `chow-city` cookie. A user who sets Lagos returns to Lagos results next week.

Surfaced as: "Showing results in Lagos ▾" — a label that invites change but does not demand attention. The city is visible but not prominent.

The word "Showing" is important. It says: "we're already doing something for you based on your preference." That is the product's ambient intelligence.

### 8.4 The Popular Dishes Maturity Curve

At platform launch: popular dishes shows seeded canonical Nigerian dishes in alphabetical order.

After 3 months: `SearchLog` has real data. Popular dishes reflects what users in each city are actually searching for — which may not match what an editor would have curated.

After 6 months: city-level behavior patterns emerge. Lagos searches differ from Abuja searches. The home page adapts without any editorial intervention.

This is not a recommendation engine. It is a mirror of collective behavior, rendered as utility.

---

## 9. SEO LANDING PAGES

### 9.1 The SEO Compounding Strategy

Every verified dish-restaurant pair is an SEO node. The more restaurants verified, the more surface area the platform has for organic search.

This is not a marketing insight — it is an engineering constraint. The SEO pages must be built to scale to thousands of dish-city combinations without becoming slow or structurally unsound.

### 9.2 SEO Page Inventory

| Page | URL | Content | Pre-rendered | Revalidation |
|---|---|---|---|---|
| Home | `/` | Discovery: hero, popular dishes, recent restaurants | Yes (ISR) | `3600s` |
| Dish landing | `/dishes/[dish-slug]` | All restaurants serving that dish | Yes (ISR) | `1800s` |
| Category browse | `/category/[category-slug]` | All restaurants in that category | Yes (ISR) | `3600s` |
| Search page | `/search` | Dynamic query results | No — noindex | n/a |

**The `/search` page is never indexed.** Its content is dynamic and user-driven. It must include `<meta name="robots" content="noindex, follow">` in its page metadata.

### 9.3 Dish Landing Page SEO Metadata

```typescript
// In /dishes/[dish-slug]/page.tsx via generateMetadata()
{
  title: `Where to Eat ${dish.canonicalName} in ${city} — Verified Restaurants | Chow Here`,
  description: `Find verified Nigerian restaurants serving ${dish.canonicalName} in ${city}. ${restaurantCount} verified options with confirmed dishes and real photos.`,
  openGraph: {
    type: 'website',
    title: `${dish.canonicalName} in ${city} — Verified Nigerian Restaurants`,
    description: ...,
    images: [{ url: featuredRestaurantThumbnail, width: 1200, height: 630 }],
    siteName: 'Chow Here',
  },
  alternates: {
    canonical: `${NEXT_PUBLIC_APP_URL}/dishes/${dish.slug}?city=${city}`,
  },
  robots: { index: true, follow: true },
}
```

### 9.4 Structured Data on Dish Landing Pages

Each dish landing page injects an `ItemList` JSON-LD block into the `<head>`:

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Restaurants serving Jollof Rice in Lagos",
  "numberOfItems": 14,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Restaurant",
        "name": "Mama Titi's Kitchen",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "...",
          "addressLocality": "Lagos",
          "addressRegion": "Lagos State",
          "addressCountry": "NG"
        },
        "telephone": "...",
        "servesCuisine": ["Nigerian"],
        "url": "https://chowhere.com/restaurants/mama-titis-kitchen"
      }
    }
  ]
}
```

This structured data allows Google to potentially render a rich snippet listing multiple restaurants for queries like "where to eat jollof rice in Lagos."

### 9.5 Home Page SearchAction Structured Data

The home page includes a `WebSite` schema with `SearchAction` to enable Sitelinks Search Box in Google:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://chowhere.com",
  "name": "Chow Here",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://chowhere.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

### 9.6 generateStaticParams for Dish Pages

```typescript
// In /dishes/[dish-slug]/page.tsx
export async function generateStaticParams() {
  const dishes = await db.dishTaxonomy.findMany({
    where: { isActive: true },
    select: { slug: true }  // requires slug field — see §16 Step 0
  })
  return dishes.map(d => ({ 'dish-slug': d.slug }))
}
```

All active dishes are pre-rendered at build time. New dishes added by admin are picked up at the next ISR revalidation.

---

## 10. MOBILE-FIRST SEARCH EXPERIENCE

### 10.1 Search Bar Specifications

The search bar is the most important interactive element in the product.

| Property | Desktop | Mobile |
|---|---|---|
| Height | 52px | 48px |
| Width | max-width 640px, centered in hero | 100% minus 32px horizontal padding |
| Font size | `text-lg` (18px), `neutral-900` | `text-base` (14px), `neutral-900` |
| Placeholder | "Search for a dish..." | "Search for a dish..." |
| Horizontal padding | 16px | 16px |
| Vertical padding | 14px | 12px |
| Radius | `radius-md` (10px) | `radius-md` (10px) |
| Border | 1.5px `neutral-200` rest / `amber-500` focus | same |
| Focus ring | `shadow-brand` | `shadow-brand` |
| Left icon | Lucide `Search`, 20px, `neutral-400` | same |
| Right accessory | Clear (×) when text present; city chip when empty | same |

The search bar is in the consumer top navigation on desktop (per DS §10.5) and in the hero section of the home page. On mobile, the top navigation shows only the wordmark and a Search icon that opens the full-screen expansion.

### 10.2 Mobile Search Expansion (Full-Screen Mode)

On mobile (< `lg` breakpoint), tapping the Search nav item or any search trigger opens a full-screen search experience:

```
1. Backdrop fades in: rgba(0,0,0,0.4), 200ms ease-out
2. Full-screen overlay slides up from bottom or fades in, 300ms ease-out
3. Search input is focused, keyboard opens
4. Suggestion list appears below the input as a scrollable list
5. Back button (Lucide ArrowLeft, 24px) replaces the search icon on the left
6. Pressing back or Escape collapses the overlay (300ms ease-in), focus returns to trigger
```

This prevents the autocomplete dropdown from being obscured by the native keyboard.

**ARIA on the expanded overlay:**
```html
<div role="combobox" aria-expanded="true" aria-autocomplete="list" 
     aria-controls="search-suggestions" aria-haspopup="listbox">
```

### 10.3 Autocomplete Suggestions

**Desktop:** Floating panel below the search bar, `shadow-md`, `radius-lg` (12px), max-height 320px, scrollable.

**Mobile:** Inline list within the full-screen overlay — no separate panel.

**Each suggestion item:**
```
[Dish canonical name]            [Category badge]
[Alias hint if alias matched]
```

- Selected: `amber-50` background, `200ms ease-out` transition
- Keyboard: arrow up/down navigates, Enter selects, Escape closes
- Maximum 8 results

### 10.4 Bottom Navigation Integration

The consumer bottom nav (built in Track 3, `src/components/layout/ConsumerBottomNav.tsx`) must be extended:

- **Search tab** activates when current route matches `/search*`, `/dishes/*`, or `/category/*`
- **Discover tab** activates only on `/` (home page)
- Tapping the Search tab from any page navigates to `/search` and auto-focuses the input

### 10.5 Thumb Zone and Touch Targets

Search bar: top of screen, reachable in one tap.
Category chips: horizontal scroll — entire row must be in the thumb zone (lower 60% of screen) on the home page.
Bookmark icon on search cards: 40×40px minimum touch target (DS §8.5).
City selector chip: 44×44px minimum touch target.

All interactive elements comply with DS §8.5 touch target sizes.

---

## 11. SKELETON LOADING STRATEGY

### 11.1 Principles (DS §16.1)

- Skeleton appears where content will appear — same layout, same dimensions
- 200ms delay before showing on page content (prevents flash for fast loads)
- No delay on search result skeletons — the search submission is an intentional act; show immediately
- No skeleton for autocomplete — either results appear within 300ms or nothing shows

### 11.2 Per-Context Skeleton Specifications

| Context | Skeleton Pattern | Show Delay | Notes |
|---|---|---|---|
| Search results (after submission) | 8 `SearchRestaurantCard` skeletons in the results grid | 0ms | User is actively waiting |
| Home page popular dishes | 8 rectangular tiles, 48px height, 120px width | 200ms | Page ISR load |
| Home page restaurant cards | 4 `RestaurantCard` skeletons | 200ms | Page ISR load |
| Category page | 12 `RestaurantCard` skeletons in grid | 200ms | Full grid |
| Dish landing page | 8 `SearchRestaurantCard` skeletons in grid | 200ms | Full grid |
| Search page idle state | None — static content (popular searches, category chips) | — | Pre-loaded, no skeleton |
| Autocomplete | None — show results or nothing | — | Never skeleton the dropdown |

### 11.3 Stagger Animation on Search Results

When search results arrive (replacing skeletons):

```css
/* DS §7.5 — 40ms stagger, max 6 in the chain */
.result-card:nth-child(1) { animation-delay: 0ms; }
.result-card:nth-child(2) { animation-delay: 40ms; }
.result-card:nth-child(3) { animation-delay: 80ms; }
.result-card:nth-child(4) { animation-delay: 120ms; }
.result-card:nth-child(5) { animation-delay: 160ms; }
.result-card:nth-child(6) { animation-delay: 200ms; }
/* Cards 7+ enter simultaneously at 200ms */
```

Each card enters with: `opacity: 0 → 1`, `translateY: 12px → 0`, `300ms ease-out`.

Skeleton cards fade out with `opacity: 1 → 0, 150ms ease-in` immediately before the staggered entrance begins.

### 11.4 Zero-Result Transition

When a search returns zero results:
- Skeleton cards exit: `opacity 1 → 0`, `150ms ease-in`
- Zero results empty state enters: `opacity 0 → 1`, `300ms ease-out`
- No layout shift — the empty state occupies the same minimum height as 4 card rows

---

## 12. FUTURE NAVIGATION COMPATIBILITY

Track 4 must not make any decision that forecloses the Phase 2 navigation path. This section defines the hard constraints.

### 12.1 Restaurant Card Layout Must Accommodate Distance

When Phase 2 adds `latitude`/`longitude` to the `Restaurant` schema, search results will show "1.4 km away" on each card. The `SearchRestaurantCard` must include this slot now:

```typescript
interface SearchRestaurantCardProps {
  restaurant: SearchRestaurantResult
  onSave: (restaurantDishId: string) => void
  isSaved: boolean
  distance?: string  // "1.4 km" — Phase 2 populates; Phase 1 leaves absent
}
```

If `distance` is absent or undefined, the slot is invisible. No empty space. The layout accommodates it via a conditional element:

```tsx
{distance && (
  <span className="text-sm text-neutral-500">
    <MapPin size={12} /> {distance}
  </span>
)}
```

### 12.2 Search Results Layout Must Accommodate a Map Panel

Phase 2 may introduce a list/map toggle on the search results page. The container must not be hardcoded to `w-full`:

```tsx
// Phase 1
<div className="w-full">
  <SearchResultsGrid results={results} />
</div>

// Phase 2-compatible (Phase 1 still renders identically):
<div className="flex gap-6">
  <div className="flex-1 min-w-0">
    <SearchResultsGrid results={results} />
  </div>
  {/* mapPanel slot — empty in Phase 1 */}
</div>
```

The `flex-1 min-w-0` pattern means the grid takes all available space when no map panel exists, and naturally shrinks when the map panel is inserted.

### 12.3 distanceKm Placeholder in API Response

The search API response includes `distanceKm: null` on every restaurant result in Phase 1. When Phase 2 adds lat/lng, this field is populated. The contract is set now so no client-side changes are needed:

```typescript
// In SearchRestaurantResult type:
distanceKm: number | null  // null in Phase 1; populated in Phase 2
```

### 12.4 URL Structure Compatible with Navigation Deep Links

The Phase 2 navigation feature will use restaurant slugs as anchors. Track 4 must not introduce any URL pattern that conflicts:

- Search results link to: `/restaurants/[slug]` (Track 3 profile page) — unchanged
- Navigation deeplink target will be: `/restaurants/[slug]/navigate` (Phase 2)
- There is no conflict. Track 4 does not introduce new routes under `/restaurants/`.

### 12.5 What Track 4 Must Not Build

- No distance labels that are not computed from real GPS coordinates
- No "Nearby" labels based on city text matching alone
- No "Get Directions" CTA that hands off to Google Maps and presents itself as in-product navigation
- The address link on cards opens the native maps app (same as Track 3 §10.3) — positioned as a utility, clearly labeled as such

---

## 13. SCHEMA MIGRATION REQUIRED

### 13.1 DishTaxonomy.slug — Required Before Step 17

`DishTaxonomy` does not have a `slug` field. The SEO dish landing pages at `/dishes/[dish-slug]` cannot be built without it.

**Migration specification:**

```prisma
model DishTaxonomy {
  // ... existing fields ...
  slug String @unique @db.VarChar(200)  // ADD THIS
  // ...
}
```

**Slug generation rules (same as Restaurant.slug):**
- Generated from `canonicalName` via the same logic used in `slug.service.ts`
- Lowercase, hyphenated, ASCII-safe
- Unique — collisions append a numeric suffix (`egusi-1`, `egusi-2`)
- Immutable after creation — slugs must never be regenerated for existing dishes

**Seed data update:** All existing `DishTaxonomy` records in `prisma/seed/dishes.data.ts` must have slugs added as part of this migration.

**Migration file:** `prisma/migrations/[timestamp]_add_dish_taxonomy_slug/migration.sql`

This migration is **Step 0** of the Track 4 implementation sequence and is a prerequisite for Steps 17 and 18.

### 13.2 No Other Schema Changes Required

All other fields needed by Track 4 already exist:

| Field | Model | Status |
|---|---|---|
| `query`, `location`, `resultCount` | `SearchLog` | Exists |
| `query`, `location` | `UserSearchHistory` | Exists — note: field is `.location`, not `.city` |
| `restaurantDishId`, `userId`, `notes` | `SavedDish` | Exists |
| `slug`, `name`, `city`, `confidenceScore` | `Restaurant` | Exists |
| `canonicalName`, `aliases`, `category`, `isActive` | `DishTaxonomy` | Exists |
| `nameAsServed`, `availabilityStatus`, `price`, `verifiedAt` | `RestaurantDish` | Exists |

---

## 14. API BOUNDARIES

### 14.1 New Routes Delivered by Track 4

| Method | Route | Auth | Rate Limit | Description |
|---|---|---|---|---|
| GET | `/api/v1/search` | None | 60/IP/min | Universal search: dishes + restaurants |
| GET | `/api/v1/search/dishes/:dishId/restaurants` | None | 60/IP/min | Restaurants serving a specific dish |
| GET | `/api/v1/search/dishes` | None | 60/IP/min | Browse dish taxonomy by category |
| GET | `/api/v1/search/suggestions` | None | 120/IP/min | Autocomplete prefix suggestions |
| GET | `/api/v1/discovery/popular-dishes` | None | 30/IP/min | Top searched dishes by location (30-day window) |
| GET | `/api/v1/discovery/trending-dishes` | None | 30/IP/min | Trending dishes by location (7-day accelerated window) |
| GET | `/api/v1/discovery/just-verified-dishes` | None | 30/IP/min | Recently verified RestaurantDish records (dish-first) |

The search routes are specified in detail in `search-system-track.md §8`. Track 4 implements them exactly, with one addition to the restaurant result shape: the `matchedDish.restaurantDishId` field (§7.2).

### 14.2 Discovery API: GET /api/v1/discovery/popular-dishes

```
Query params:
  location: string (optional) — maps to SearchLog.location
  limit: number (default: 8, max: 20)
  window: "7d" | "30d" (default: "30d")

Response:
{
  "success": true,
  "data": {
    "dishes": [
      {
        "dishId": "uuid",
        "canonicalName": "Jollof Rice",
        "slug": "jollof-rice",
        "category": "RICE_DISHES",
        "searchCount": 142,
        "restaurantCount": 8
      }
    ],
    "location": "Lagos" | null,
    "window": "30d"
  }
}
```

`searchCount` comes from SearchLog aggregation. `restaurantCount` is a live count of approved restaurants serving the dish in the location. Both are computed and cached together.

### 14.3 Discovery API: GET /api/v1/discovery/recently-verified

```
Query params:
  location: string (optional)
  limit: number (default: 4, max: 8)

Response:
{
  "success": true,
  "data": {
    "restaurants": [
      {
        "id": "uuid",
        "name": "...",
        "slug": "...",
        "city": "...",
        "area": null | "...",
        "priceRange": "MID",
        "confidenceScoreBand": "STRONG",
        "thumbnailUrl": null | "...",
        "dishCount": 7,
        "approvedAt": "ISO-8601"
      }
    ]
  }
}
```

Returns only `APPROVED` restaurants with `deletedAt IS NULL`. Ordered by `approvedAt DESC`. Never exposes `confidenceScore` numeric value.

### 14.4 Deferred to Track 5: Save API

The save/unsave API (`/api/v1/users/saved-dishes`) is Track 5 scope. Track 4 defines the contract (§7.4) and builds the UI. Until Track 5 is complete, the save button is present in the UI but calls fail gracefully: "Sign in to save dishes" if unauthenticated; silent stub if authenticated.

---

## 15. UI BOUNDARIES

### 15.1 Routes Delivered by Track 4

| Route | Type | Description |
|---|---|---|
| `/` | SSR + ISR | Home page — discovery entry point |
| `/search` | Client-rendered, noindex | Search interface — query state, results, zero results |
| `/dishes/[dish-slug]` | SSR + ISR | Dish landing page — primary SEO asset |
| `/category/[category-slug]` | SSR + ISR | Category browse |

Track 4 does not deliver:
- `/dashboard/saved` (Track 5)
- `/submit` or `/verify/respond` (pending Track 2 UI steps)
- `/restaurants` or `/restaurants/[slug]` (Track 3 — already built)
- Any admin routes

### 15.2 Component Structure

```
features/search/
├── services/
│   ├── search.service.ts              ← Orchestrator (routes to dish/restaurant search)
│   ├── dish-search.service.ts         ← Dish FTS + alias resolution + trigram fallback
│   ├── restaurant-search.service.ts   ← Restaurant name FTS + city filter
│   ├── dish-restaurant.service.ts     ← Dish → ranked restaurant list
│   ├── suggestion.service.ts          ← Autocomplete prefix queries (8 results max)
│   ├── search-log.service.ts          ← Async fire-and-forget log write
│   └── discovery.service.ts           ← Popular dishes + recently verified
├── schemas/
│   └── search.schema.ts               ← Zod: query param validation for all search routes
├── hooks/
│   ├── useSearch.ts                   ← TanStack Query wrapper for /api/v1/search
│   ├── useSearchSuggestions.ts        ← Debounced 150ms autocomplete hook
│   └── useSavedDish.ts                ← Optimistic save/unsave, Zustand-backed
├── stores/
│   └── search.store.ts                ← Zustand: cityContext (from cookie), recentSearches
├── components/
│   ├── SearchBar.tsx                  ← Input + autocomplete + mobile full-screen expansion
│   ├── SearchResults.tsx              ← Results display: dish tiles section + restaurant cards
│   ├── DishResultTile.tsx             ← Dish in search results (name + category + count)
│   ├── SearchRestaurantCard.tsx       ← Restaurant card with bookmark + dish context
│   ├── ZeroResults.tsx                ← Empty state: suggestions + CTA
│   ├── CategoryChips.tsx              ← Horizontal scrollable category chip row (home page)
│   ├── DishDiscoveryTile.tsx          ← Dish tile for Popular/Trending sections (§4.5)
│   ├── DishDiscoveryCard.tsx          ← Dish-at-restaurant card for Just Verified (§4.5)
│   ├── PopularDishesSection.tsx       ← Popular dishes home page section
│   ├── TrendingDishesSection.tsx      ← Trending this week home page section
│   └── JustVerifiedSection.tsx        ← Just verified dishes home page section
└── types/
    └── search.types.ts                ← TypeScript types for all search surfaces
```

### 15.3 SearchRestaurantCard vs RestaurantCard

Track 3 built `RestaurantCard` (used on the browse index and dish landing pages).

Track 4 introduces `SearchRestaurantCard` — a variant for search-result contexts:

| Aspect | RestaurantCard (Track 3) | SearchRestaurantCard (Track 4) |
|---|---|---|
| Bookmark icon | None | Top-right, `Lucide Bookmark`, 40×40px touch target |
| Dish context | None | Shows `matchedDish.nameAsServed`, availability, price if known |
| Distance slot | None | `distance?: string` prop — renders if provided, invisible if absent |
| Used in | Browse index, dish landing page (neutral context) | Search results only (dish-query context) |

`RestaurantCard` is not modified. `SearchRestaurantCard` is a new component.

### 15.4 Search Store Rules

URL is the source of truth for active search queries. The Zustand store manages ephemeral UI state only (city context, recent searches for anonymous users). A search is always fully re-runnable from the URL alone — the store is not required for correctness.

```typescript
interface SearchStore {
  cityContext: string | null
  setCityContext: (city: string | null) => void
  // Anonymous-only cache of recent queries (authenticated users use UserSearchHistory API):
  anonRecentSearches: { query: string; location: string | null }[]
  addAnonRecentSearch: (query: string, location: string | null) => void
  clearAnonRecentSearches: () => void
}
```

---

## 15.5 UI QUALITY STANDARDS

Every Track 4 UI component must pass all six quality gates before it is considered complete. These are not optional polish — they are part of the definition of done.

### 15.5.1 Skeleton Loading States

Every component that fetches data must have a skeleton state. Rules from DS §16:

| Rule | Requirement |
|---|---|
| Skeleton dimensions | Exactly match the rendered content — same width, same height, same grid slot |
| Shimmer style | `neutral-200` background, diagonal gradient sweep, `1400ms ease-in-out infinite` |
| Delay on page content | 200ms — do not flash skeletons for fast loads |
| Delay on search results | 0ms — user expressed intent; show immediately |
| Delay on autocomplete | Never show skeleton — show results or nothing |
| Reduced motion | Static `neutral-200` fill — no shimmer animation |

Per-component skeleton inventory for Track 4:

| Component | Skeleton Elements |
|---|---|
| `DishDiscoveryTile` | 48px square block + 2 text lines + 1 tag row |
| `DishDiscoveryCard` | Full-width, 2 text lines left + badge right |
| `SearchRestaurantCard` | Photo block (4:3) + 3 text lines + 1 tag row |
| `SearchBar` | Full-width input block (height matches input) |
| Home page — Popular section | 8 `DishDiscoveryTile` skeletons in scroll row |
| Home page — Trending section | 8 `DishDiscoveryTile` skeletons in scroll row |
| Home page — Just Verified section | 6 `DishDiscoveryCard` skeletons |
| Search results grid | 8 `SearchRestaurantCard` skeletons |
| Dish landing page | 8 `SearchRestaurantCard` skeletons |
| Category page | 12 `RestaurantCard` skeletons |

### 15.5.2 Empty States

Every section and page with a data-dependent rendering must have a specified empty state. Rules from DS §15:

Every empty state must be: **Specific** (explains what is empty and why) · **Actionable** (provides a clear next step) · **Honest** (does not imply an error for expected states) · **Warm** (not a generic box or search icon)

| Context | Headline | Body | CTA |
|---|---|---|---|
| Search — no results for dish | "No results for "[query]"" | "We haven't verified a restaurant serving this dish in [city] yet." | "Submit a restaurant" + "Search all cities" |
| Search — no results (no city set) | "No results for "[query]"" | "No verified restaurants serve this dish yet." | "Submit a restaurant" |
| Dish landing page — no results in city | "No restaurants serve [Dish] in [City] yet" | "We haven't verified this dish in [City]. It may be available in other cities." | "Submit a restaurant" + city tab to All |
| Category page — no results | "No [Category] restaurants verified in [City] yet" | "This category hasn't been covered in [City] yet." | "Submit a restaurant" |
| Home page — trending section (< 4 dishes) | Section omitted entirely | — | — |
| Home page — just verified (no results in city) | Section omitted entirely | — | — |

**Rules for home page sections:** Sections 4 (Trending) and 5 (Just Verified) are omitted entirely when their data conditions are not met. They never render with an empty state — their absence is cleaner than a "nothing here yet" message.

**Rules for full pages:** The search results page, dish landing page, and category page always show their empty state when data is absent. They never show a blank page.

### 15.5.3 Error States

Track 4 must handle these specific error scenarios per DS §17:

| Scenario | Response | Visual |
|---|---|---|
| Search API timeout (> 500ms per §12.1 of search-system-track.md) | Show zero results empty state with "Search timed out. Try again." | ZeroResults component with timeout flag |
| Search API 5xx | Toast error: "Search is temporarily unavailable. Please try again." + retry button | Error toast per DS §10.8 |
| Discovery API failure (home page section) | Section silently omitted — no error shown to user | None — silent degradation |
| Autocomplete failure | Dropdown simply doesn't open — no error shown | None — silent degradation |
| Save action failure | Toast error: "Could not save — please try again" + revert optimistic update | Error toast per DS §10.8 |
| Dish landing page — dish not found (bad slug) | Full-page 404 | Per DS §17.4 — "This page doesn't exist" |
| City cookie corruption | Fall back to no-city (nationwide) state, do not throw | Silent recovery |

**Silent degradation rule for discovery sections:** Discovery features (popular dishes, trending, just verified) are enhancement features — they improve the experience but are not required for the core search function. If any discovery API fails, the section is silently omitted. The user can still search. Never show a discovery section error state.

**Never show a 500 for a malformed search query.** Per `search-system-track.md §11.3`, malformed `to_tsquery` input must fall back to trigram search, not throw.

### 15.5.4 Accessibility Review

Every Track 4 component must pass this accessibility checklist before merge:

**ARIA patterns (DS §8.4):**
- `SearchBar`: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` pointing to the suggestion list
- Suggestion list: `role="listbox"`, each item `role="option"`, `aria-selected` on highlighted item
- `DishDiscoveryTile` and `DishDiscoveryCard`: navigable as links (`<a>` elements or buttons with `role="link"`) — not `<div onClick>`
- Category chips: `role="link"` or standard `<a>` elements — each chip has a descriptive accessible label
- Bookmark button: `aria-label="Save [Dish Name] at [Restaurant Name]"` (not just "Save")
- `ZeroResults` CTAs: descriptive labels, not generic "Click here"

**Keyboard navigation:**
- Search bar: Tab to focus, arrow keys to navigate suggestions, Enter to select, Escape to close/clear
- Category chips: standard Tab order through the row
- Dish discovery cards: Tab navigable, Enter/Space activates
- Bookmark: reachable with Tab from within the card; does not break card navigation flow

**Focus management:**
- Mobile search expansion: when expanded, focus is trapped in the search overlay
- When collapsed: focus returns to the element that triggered the expansion
- Modal (if any): per DS §8.3

**Contrast:**
- All text meets WCAG AA (4.5:1 normal, 3:1 large) per DS §8.2
- `amber-500` on white fails for body text — never use amber as body text color (per DS §2.3)
- Verify: `green-500` verified badge text meets contrast on all card backgrounds

**Touch targets (DS §8.5):**
- All interactive elements: minimum 44×44px (primary buttons), 40×40px (secondary icons)
- Bookmark icon: 40×40px minimum
- Category chips: 44px minimum height
- Dish discovery cards: 48px minimum height

### 15.5.5 Mobile-First Behavior

Every component must be reviewed at three viewport widths before being considered complete:

| Breakpoint | Width | Requirement |
|---|---|---|
| Mobile (`xs`) | 375px | Fully functional, no horizontal overflow, no truncated interactive elements |
| Tablet (`md`) | 768px | Layout enhancement visible, nothing broken |
| Desktop (`lg`) | 1280px | Full desktop layout rendered correctly |

**Track 4 mobile-specific requirements:**
- Home page category chips: horizontal scroll with `overflow-x: auto`, `scroll-snap-type: x mandatory`, no visible scrollbar (`scrollbar-none` utility already in globals.css)
- Home page popular dishes: same horizontal scroll behavior as category chips — dish tiles scroll horizontally on mobile, wrap to grid on tablet+
- Home page trending section: same horizontal scroll behavior
- Home page just verified: full-width vertical stack on mobile (single column), 2-column on tablet, 3-column on desktop
- Search bar: full-screen expansion on mobile tap (§10.2), inline dropdown on desktop
- Bottom nav: Search tab activates on all Track 4 routes (`/search*`, `/dishes/*`, `/category/*`)
- Safe area insets: all fixed elements use `env(safe-area-inset-bottom)` (already established in Track 3 layout)

**Typography scaling (DS §9.6):**
- Fraunces `text-4xl` headings on desktop → `text-2xl` on mobile
- Fraunces `text-2xl` section headings on desktop → `text-xl` on mobile

### 15.5.6 Motion Review

Every animation must pass all four DS §7.1 tests: **Fast · Subtle · Purposeful · Premium**

Track 4 animation inventory:

| Interaction | Duration | Easing | Properties | Test |
|---|---|---|---|---|
| Dish discovery tile hover | `200ms` | `ease-out` | `translateY(-2px)`, `box-shadow` | Subtle: noticed only when removed |
| Dish discovery card hover | `200ms` | `ease-out` | `translateY(-2px)`, `box-shadow` | same |
| Search result stagger entrance | `300ms` per card, staggered `40ms` | `ease-out` | `opacity 0→1`, `translateY 12px→0` | Purposeful: communicates results arriving |
| Mobile search expansion | `300ms` | `ease-out` | backdrop fade + overlay translate | Premium: matches native app feel |
| Mobile search collapse | `200ms` | `ease-in` | reverse | Fast: exits faster than it enters |
| Autocomplete dropdown open | `200ms` | `ease-out` | `opacity 0→1`, `translateY(-4px)→0` | Subtle |
| Autocomplete dropdown close | `150ms` | `ease-in` | `opacity 1→0` | Fast exit |
| Bookmark save | `200ms` | `ease-spring` | icon fill transition | Purposeful: "snap" of saving |
| Zero results transition | `150ms` exit + `300ms` enter | `ease-in` / `ease-out` | skeleton out, empty state in | No layout shift |
| Skeleton shimmer | `1400ms` | `ease-in-out`, infinite | `background-position` | Linear easing forbidden — use `ease-in-out` |

**Prohibited (DS §7.7):**
- Scroll-triggered entrance animations on any consumer page
- Parallax effects
- Bouncing or overshoot (beyond `ease-spring` on small elements)
- Auto-playing video or motion backgrounds
- Infinite pulsing, floating, or decorative animations

**Reduced motion:** All animations collapse to `0ms` under `prefers-reduced-motion: reduce`. Skeleton shimmer becomes a static fill. Hover transforms are removed (color transitions remain). This is enforced globally via the rule in DS §7.6 already in `globals.css`.

---

## 16. IMPLEMENTATION SEQUENCE

Track 4 follows the implementation law: Schema → Service → API → UI.

### Step 0 — DishTaxonomy Slug Migration (Prerequisite)

**Before any other work begins:**
1. Add `slug String @unique @db.VarChar(200)` to `DishTaxonomy` in `prisma/schema.prisma`
2. Write migration: generate slug from `canonicalName` using the same logic as `slug.service.ts`
3. Update `prisma/seed/dishes.data.ts` to include slugs for all seeded dishes
4. Run migration and verify all seeded dishes have unique slugs
5. Update `database-track.md` to document this addition
6. Write a unit test confirming slug uniqueness constraint is enforced

This step modifies the schema. Per AD-9, the update to `database-track.md` is mandatory before the migration is applied.

### Step 1 — Infrastructure Verification

1. Verify all GIN indexes exist: `\d "DishTaxonomy"` and `\d "Restaurant"` in psql — confirm `idx_dish_search` and `idx_restaurant_search` are present
2. Verify FTS triggers are firing: insert a test `Restaurant` record and confirm `searchVector` is populated
3. Run the raw SQL queries from `search-system-track.md §3.1` and `§4.1` against seeded data
4. Manually test the top 10 dish queries for search quality: jollof rice, egusi soup, suya, pepper soup, pounded yam, eba, ogbono, efo riro, moi moi, akara
5. Document any gaps in FTS quality for these queries (e.g., Igbo/Yoruba terms not indexing correctly)
6. Commit infrastructure verification findings as a comment in `search-system-track.md §14`

**No code is written in this step.** It is a verification gate. If the indexes are missing or the triggers are not firing, stop and fix the database before proceeding.

### Step 2 — Dish Search Service

1. `features/search/services/dish-search.service.ts`
2. Stage 1: FTS query on `DishTaxonomy` via `websearch_to_tsquery + unaccent`
3. Stage 2: trigram fallback if FTS returns zero results (`similarity > 0.3`)
4. Alias resolution via FTS weight B (automatic — no separate query)
5. Unit tests (minimum 20 cases):
   - Exact canonical name match
   - Alias match ("eba" → garri)
   - Typo tolerance ("egussi" → egusi)
   - Multi-word query ("jollof rice")
   - Single-word partial ("jollof")
   - Zero results (returns empty, no throw)
   - Malformed query (special characters) — must not throw, must fall back
   - SQL injection attempt via query string — Prisma parameterization verifies this

### Step 3 — Restaurant Search Service

1. `features/search/services/restaurant-search.service.ts`
2. FTS query on `Restaurant.searchVector` with city filter
3. Only `APPROVED` restaurants, `deletedAt IS NULL`
4. Unit tests: name match, city filter enforcement, approved-only gate

### Step 4 — Dish-to-Restaurant Resolver

1. `features/search/services/dish-restaurant.service.ts`
2. Ranked list of restaurants serving a given `dishId`
3. Implements the ranking formula from §5.1 exactly
4. City/area filter support
5. Pagination (default 20, max 20 per `search-system-track.md §8.2`)
6. **Includes `restaurantDishId` in result shape** (needed for the save action)
7. Unit tests: ranking order validation (confidence as tiebreaker), city filter, approved-only gate, pagination edge cases

### Step 5 — Search Orchestrator + Zero-Result Handling

1. `features/search/services/search.service.ts`
2. Routes to dish search, restaurant search, or both based on `type` param
3. Merges and structures results for `type = "all"`
4. Zero-result handling: runs trigram fallback, generates static suggestions
5. Unit tests: routing logic, merge logic, zero-result path, suggestions array shape

### Step 6 — Autocomplete Service

1. `features/search/services/suggestion.service.ts`
2. Prefix match: `DishTaxonomy.canonicalName ILIKE :prefix || '%'`
3. Alias match: prefix search on flattened aliases array
4. Returns max 8 results with `dishId`, `canonicalName`, `category`, `aliasMatched: boolean`
5. Unit tests: prefix matching, alias matching, max-results enforcement, min-chars enforcement (≥ 2)

### Step 7 — Search Logging Service

1. `features/search/services/search-log.service.ts`
2. Anonymous logging to `SearchLog` (uses `location` field, not `city`)
3. Authenticated logging to `UserSearchHistory` (uses `location` field)
4. Fire-and-forget pattern: never `await` the log write; failure is logged but does not affect response
5. Unit tests: verify log is written; verify failure does not propagate to caller; verify response timing is not affected (assert no await)

### Step 8 — Search API Endpoints

1. Implement all 4 routes from `search-system-track.md §8`
2. `features/search/schemas/search.schema.ts` — Zod validation for all query params
3. Rate limiting via existing `rate-limit.ts` infrastructure
4. Fire-and-forget search log wired into the search endpoint handler
5. Integration tests for all 4 endpoints including the `matchedDish.restaurantDishId` field in responses
6. Verify: search log appears in DB after request; response time is not measurably affected by logging

### Step 9 — Discovery Service

1. `features/search/services/discovery.service.ts`
2. `getPopularDishes(location?, window?): PopularDish[]` — SearchLog aggregation + normalization + DishTaxonomy matching + seeded fallback
3. `getRecentlyVerified(location?, limit?): RestaurantSummary[]` — recently approved restaurants, abbreviated shape (no raw score)
4. Both methods use Next.js `unstable_cache` with 60-second TTL
5. Unit tests: aggregation with mock SearchLog data, seeded fallback behavior, recently verified ordering

### Step 10 — Discovery API Endpoints

1. `GET /api/v1/discovery/popular-dishes`
2. `GET /api/v1/discovery/recently-verified`
3. No auth, rate limit 30/IP/min each
4. Integration tests

### Step 11 — Search Hooks and Store

1. `features/search/stores/search.store.ts` — Zustand store (city context, anon recent searches)
2. Cookie hydration: read `chow-city` cookie on store initialization (client-side)
3. `features/search/hooks/useSearch.ts` — TanStack Query, keyed by `[q, city, type, page]`
4. `features/search/hooks/useSearchSuggestions.ts` — debounced 150ms, aborts stale requests
5. `features/search/hooks/useSavedDish.ts` — optimistic update stub; full implementation deferred to Track 5

### Step 12 — Search Types

1. `features/search/types/search.types.ts`
2. All TypeScript types for search results, query params, suggestion items, discovery data
3. Use `z.infer<>` from Zod schemas where possible
4. Verify: no `any` anywhere in this file

### Step 13 — SearchBar Component

1. `features/search/components/SearchBar.tsx`
2. Desktop: input + floating suggestion dropdown
3. Mobile: full-screen overlay expansion on focus (per §10.2)
4. Suggestion list: dish tiles with category badge and alias hint
5. Idle state: recent searches (authenticated) or popular searches (anonymous)
6. Clear button, back button (mobile), city chip
7. ARIA: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`
8. Keyboard: arrow up/down navigates suggestions, Enter selects or submits, Escape closes
9. Respects `prefers-reduced-motion`: no expansion animation when reduced motion is set

### Step 14 — Search Result Components

1. `features/search/components/DishResultTile.tsx` — dish name + category badge + restaurant count
2. `features/search/components/SearchRestaurantCard.tsx` — restaurant card with bookmark icon, dish context, distance slot
3. `features/search/components/ZeroResults.tsx` — empty state: specific headline, body, two CTAs
4. All skeletons built alongside their content components (not as an afterthought)
5. All comply with DS §10.3, §10.4, §15.2, §16.2

### Step 15 — Search Results Page

1. `app/(public)/search/page.tsx`
2. Reads `q`, `city`, `type`, `page` from `searchParams` (URL is source of truth)
3. `<meta name="robots" content="noindex, follow">` in `generateMetadata()`
4. Results layout: dish tiles section first (if results contain dish matches), restaurant cards section below
5. Pagination: URL-based, previous/next, same pattern as Track 3 browse index
6. `app/(public)/search/loading.tsx` — 8 card skeletons in the results grid

### Step 16 — Home Page

1. `app/(public)/page.tsx`
2. Hero section: wordmark + SearchBar + tagline
3. CategoryChips: horizontal scroll, tapping navigates to `/category/[category-slug]`
4. PopularDishes section: server component, fetches from discovery service
5. RecentRestaurants section: server component, fetches from discovery service
6. `WebSite` JSON-LD with `SearchAction` in the page head (§9.5)
7. `revalidate: 3600`
8. `app/(public)/loading.tsx` — home page skeleton (hero placeholder + category chips placeholder + 8 dish tile placeholders + 4 card placeholders)

### Step 17 — Dish Landing Pages

1. `app/(public)/dishes/[dish-slug]/page.tsx`
2. **Requires Step 0 (slug migration) to be complete**
3. `generateStaticParams()` across all active dishes
4. `generateMetadata()` per dish with city context
5. City filter tabs (if multiple cities have results for this dish)
6. Restaurant grid using `SearchRestaurantCard`
7. Empty state per city
8. `ItemList` JSON-LD structured data (§9.4)
9. `revalidate: 1800`
10. `app/(public)/dishes/[dish-slug]/loading.tsx` — 8 card skeletons

### Step 18 — Category Browse Pages

1. `app/(public)/category/[category-slug]/page.tsx`
2. `generateStaticParams()` across all 9 `DishCategory` values
3. Static category descriptions object (defined inline in the service, not in the DB)
4. City filter tabs
5. Restaurant card grid using `RestaurantCard` from Track 3 (no save button needed — generic browse context)
6. `revalidate: 3600`

### Step 19 — Search History and Logging Integration Verification

1. Verify `SearchLog` is written after every search API call — confirm with integration test measuring response time with and without logging
2. Verify `UserSearchHistory` is written for authenticated search requests
3. Surface `UserSearchHistory` in the `SearchBar` suggestion list for authenticated users
4. End-to-end test: authenticated user makes 3 searches → check bar shows last 3 in idle state

---

## 17. SUCCESS METRICS

### 17.1 Functional Completeness

| Metric | Target | Verification |
|---|---|---|
| Search for each of the 10 core dish names returns ≥ 1 result from seeded data | 100% | Integration test suite |
| "eba" → resolves Garri results via alias | Pass | Unit test |
| "egussi" → resolves Egusi results via trigram | Pass | Unit test |
| Zero results returns `suggestions` array with ≥ 2 items | 100% | Unit test |
| Autocomplete fires at 150ms debounce, returns ≤ 8 results | 100% | Integration test |
| Search log does not add measurable delay to response | delta < 5ms | Benchmark test |
| Dish landing pages render `ItemList` JSON-LD with no schema errors | 100% | Google Rich Results Test |
| `/search` page has `noindex` meta tag | 100% | Automated check |
| `SearchRestaurantCard` renders `restaurantDishId` for save action | 100% | Unit test |
| `distanceKm: null` present in all search restaurant responses | 100% | Contract test |

### 17.2 Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Search API P95 response time | < 200ms | Vercel Function Logs |
| Autocomplete P95 response time | < 100ms | Vercel Function Logs |
| Home page LCP | < 2.5s | Core Web Vitals |
| Dish landing page TTFB | < 200ms | Vercel Analytics |
| Search results page First Contentful Paint | < 1.0s | Lighthouse |
| Zero results empty state visible | < 500ms after submission | Manual observation |

### 17.3 SEO Targets

| Metric | Target |
|---|---|
| All dish landing pages indexable | Yes |
| Home page has `SearchAction` JSON-LD | Yes |
| Each dish page has unique title and meta description | Yes |
| Each dish page has `ItemList` structured data | Yes |
| `/search` is noindex | Yes |
| Category pages are indexable with unique titles | Yes |

### 17.4 Retention Indicators (Observable Post-Launch)

These are signals to monitor after launch — not hard targets for Track 4 delivery.

| Signal | What It Means |
|---|---|
| `SearchLog` shows repeat queries (same query, same location, within 7 days) | Loop 1 is working — users return to find the same dish |
| `SavedDish` count grows over first 30 days | Loop 2 is working — save interaction is being used |
| Home page `popular-dishes` API reflects real searches (not seeded fallback) | Platform is growing; discovery reflects behavior |
| Home page direct visits (not via search engine referral) | Users are navigating directly — returning users |

---

## 18. RISKS AND EDGE CASES

### 18.1 FTS Trigger Not Firing for New Restaurants

**Risk:** A restaurant approved after the database migration has no `searchVector` populated.

**Resolution:** The FTS trigger fires on INSERT and UPDATE. Step 1 verifies this explicitly. If the trigger is missing, search would silently return zero results for new restaurants — a data integrity failure. This must be caught before any search service code is written.

### 18.2 SearchLog Aggregation Performance at Scale

**Risk:** As `SearchLog` grows to hundreds of thousands of entries over 90 days, the popular dishes aggregation becomes slow.

**Resolution:** Phase 1 volume is low. The discovery service caches results for 60 seconds. If aggregation latency becomes measurable (> 50ms), add a partial index on `(location, "createdAt")` where `"createdAt" > NOW() - INTERVAL '30 days'`. This is a deferred optimization, not a Phase 1 requirement.

### 18.3 Popular Dishes Section Shows Arbitrary Queries

**Risk:** `SearchLog` contains raw user input including gibberish, restaurant names, and partial queries that should not surface as "popular dishes."

**Resolution:** The discovery service normalizes and matches SearchLog queries against `DishTaxonomy` (§4.4). Only queries that resolve to a real, active dish are surfaced. Unmatched queries are silently discarded. If fewer than 4 dishes match, the seeded fallback fills the remainder.

### 18.4 DishTaxonomy Slug Migration Failure

**Risk:** The slug migration runs, but some dish canonical names generate the same slug (e.g., two dishes with identical first characters after normalization).

**Resolution:** The unique constraint on `DishTaxonomy.slug` will cause the migration to fail if a collision occurs. The migration must include collision handling: append `-1`, `-2` suffixes. The same logic exists in `slug.service.ts` for restaurants — reuse it.

### 18.5 City Context Cookie Conflict

**Risk:** A user on a mobile device who has `chow-city=Lagos` stored visits the site on a different device — they see Lagos results, but they are in Abuja.

**Resolution:** This is expected behavior. City preference is a user choice, not a device detection. The city selector is always visible and one tap to change. The cookie is not a tracking mechanism — it stores an explicit user preference. There is no privacy concern.

### 18.6 Autocomplete on "Rice" — Many Valid Matches

**Risk:** A user types "rice" and receives 8 valid matches (Jollof Rice, White Rice, Fried Rice, Ofada Rice, etc.). Is this confusing?

**Resolution:** This is correct behavior. All valid dish matches surface. The user selects the one they mean. Phase 1 does not require disambiguation logic. Phase 2 may introduce popularity-ordered autocomplete (ordering by SearchLog frequency), which would naturally push "Jollof Rice" to the top of the list.

### 18.7 No Results at Launch — Honest Empty States

**Risk:** At launch, many cities have zero verified restaurants. Search results are sparse; category pages are empty.

**Resolution:** This is expected and honest. Sparse results are not a bug — they are the platform in its early state. The empty state copy is specific: "We haven't verified a restaurant serving this dish in [City] yet." The "Submit a restaurant" CTA converts the empty state into a growth mechanism. Honesty about coverage is a trust signal.

### 18.8 SavedDish Requires RestaurantDish.id — Not Exposed Everywhere

**Risk:** The search API currently (per `search-system-track.md`) does not include `RestaurantDish.id` in the restaurant result shape. Without it, the save action cannot be wired.

**Resolution:** Track 4 adds `matchedDish.restaurantDishId` to the search response shape (§7.2). This is a Track 4 addition to the spec — not a deviation from `search-system-track.md` but an extension required by the save interaction.

### 18.9 websearch_to_tsquery Edge Cases for Nigerian Dish Names

**Risk:** `websearch_to_tsquery('english', ...)` may tokenize Igbo, Yoruba, or Hausa dish names incorrectly, reducing match quality.

**Resolution:** The seeded DishTaxonomy data is the FTS index source — the tokenization quality depends entirely on how the dish names and aliases are seeded. Step 1 must validate FTS quality against the 10 most important dish queries. If quality is poor for specific names, add targeted aliases to the seed data before building the search service.

---

## Document Relationships

```
master-architecture.md              ← Governing law (highest authority)
chow-here-design-system-v1.md      ← UI law (all component decisions)
search-system-track.md             ← Search architecture (Track 4 operationalizes this document)
restaurant-listing-track.md        ← Track 3 (RestaurantCard, TrustBadge, layout patterns)
    │
    ├── backend-standards.md        ← API and service patterns
    ├── frontend-standards.md       ← React component patterns
    ├── security-standards.md       ← Rate limiting, input validation
    └── data-governance.md          ← SearchLog retention (90 days), UserSearchHistory policy
    │
    └── track-04-search-discovery.md ← THIS DOCUMENT
            │
            ├── Depends on: restaurant-listing-track.md (Track 3 complete)
            ├── Operationalizes: search-system-track.md (architecture → implementation)
            └── Feeds into: user-accounts-track.md (Track 5 — saves, history, profile)
```

---

*This document is authoritative for Track 4 implementation. No implementation code may be written until this document is reviewed and approved. Changes during implementation require explicit versioning and a note in the changelog below.*

**Changelog:**
- v1.0 — 2026-06-05 — Initial specification

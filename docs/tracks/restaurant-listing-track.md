# Chow Here — Track 3: Restaurant Listing System

**Status:** SPECIFICATION — awaiting approval before implementation begins  
**Version:** 1.0  
**Date:** 2026-06-05  
**Governed By:** master-architecture.md · chow-here-design-system-v1.md  
**Depends On:** Track 2 (verification intelligence) — must be complete before Track 3 begins  
**Next Track:** Track 4 — Search System

---

## 0. PURPOSE OF THIS DOCUMENT

This document is the authoritative architecture and product specification for the Chow Here Restaurant Listing System (Track 3). It defines what is to be built, why, and within what constraints.

No implementation code may be written for any component described here until this document has been reviewed and approved. Any conflict between this document and a standards document (`master-architecture.md`, `chow-here-design-system-v1.md`, `backend-standards.md`, etc.) is resolved in favour of the standards document. Any conflict between this document and the implementation must be investigated before proceeding.

---

## 1. BUSINESS OBJECTIVES

### 1.1 Primary Objectives

| ID | Objective | Rationale |
|---|---|---|
| BO-1 | Deliver verified restaurant profiles that consumers can trust on first sight | The product guarantee — every listing has been reviewed by a human admin with a confidence score ≥ 0.40 |
| BO-2 | Present dish-first discovery as the primary interaction model | Chow Here is not a restaurant directory. The dish is the entry point. |
| BO-3 | Expose trust signals clearly enough that users never need to read documentation to understand them | Trust that is invisible is not trust |
| BO-4 | Make food photography the primary emotional driver of the consumer experience | Real Nigerian food photography is the differentiating signal that no competitor can replicate |
| BO-5 | Ensure all public restaurant pages are indexable for organic search traffic | Restaurant and dish pages are long-term SEO assets; every verified listing adds to the food intelligence graph |
| BO-6 | Establish URL and data structures that support future in-product navigation without rework | The slug and location fields in Phase 1 must survive into Phase 2+ intact |

### 1.2 Explicit Non-Objectives

The following are explicitly out of scope for Track 3 and must not appear in any schema, API, or UI:

- User reviews or ratings (Phase 2+ with arrival confirmation signals)
- Reservation functionality
- Delivery or ordering UI
- Social sharing or activity feeds
- Restaurant-editable profiles or self-service updates
- Advertising placement or sponsored listings
- In-product navigation (defined in design system §14 but not implemented in Phase 1)
- Real-time dish availability updates
- Loyalty or rewards signals

---

## 2. USER GOALS

### 2.1 Consumer Goals

| Goal | Priority | Description |
|---|---|---|
| Find a specific dish | Critical | "I want Ofada Rice. Show me where I can get it near me." |
| Understand if a restaurant is trustworthy | Critical | "Is this listing real and current?" |
| Get enough information to make the trip | Critical | Phone number, address, what they serve, and photos |
| See what the food actually looks like | High | Food photography must convey reality, not aspiration |
| Discover dishes they didn't know to search for | High | The dish list on a profile may surface secondary dishes of interest |
| Navigate to the restaurant | Future | Phase 1 preserves the path; this feature is Phase 2+ |

### 2.2 What a Consumer Must Never Experience

- An unverified restaurant appearing in any consumer-facing surface
- A listing that looks real but has been rejected or is pending review
- Stale contact information presented without caveat
- A listing without at least one verified photo in the browseable set
- A low-confidence listing ranked above a high-confidence one

### 2.3 Submitter Goals (Adjacent, Read-Only in Track 3)

Submitters who have had their restaurant approved should see the live public profile as confirmation their submission succeeded. The listing page serves as their proof of publication. The profile URL is what the approval notification email links to (via `NEXT_PUBLIC_APP_URL/restaurants/[slug]`).

---

## 3. CONSUMER DISCOVERY WORKFLOW

The full consumer discovery journey, from intent to standing at the restaurant door:

```
1. User has a dish in mind
   ↓
2. Lands on home page or opens app — search bar is the hero
   ↓
3. Types dish name (e.g., "Efo Riro")
   ↓
4. Search results page: cards of verified restaurants that serve Efo Riro
   (ordered by: FTS relevance 40% · confidence score 35% · availability 15% · recency 10%)
   ↓
5. User taps / clicks a restaurant card
   ↓
6. Restaurant Profile Page loads:
   - Hero food photography (full width)
   - Restaurant name + verified badge + score band label
   - Address + price range + cuisine tags
   - Dish list (the originating dish highlighted)
   - Full dish catalogue for this restaurant
   - Contact details (phone, website, email)
   - About section (description)
   ↓
7. User decides: phone to confirm, or go directly
   ↓
8. [Phase 2] Tap "Get directions" → in-product navigation
```

Track 3 delivers steps 5–7. Steps 1–4 are Track 4 (Search System). Steps 8+ are Phase 2.

---

## 4. DISH-FIRST SEARCH WORKFLOW

Track 3 does not build search. However, the Restaurant Profile Page must be designed to honour the dish-first model from which users arrive.

### 4.1 Arriving From Search

When a user arrives at a restaurant profile from a dish search:
- The dish they searched for must be surfaced prominently — it is the reason they clicked
- The restaurant's full dish list is secondary (confirming breadth, not changing the reason to visit)
- The profile must not make the user feel they arrived at a generic restaurant page

### 4.2 Dish Context on the Profile Page

The `RestaurantDish` records shown on a profile include:
- `nameAsServed` — how this restaurant calls the dish (may differ from canonical name)
- `availabilityStatus` — always available, weekend only, on order, etc.
- `price` — if populated by admin during intelligence enrichment
- `verifiedAt` — admin-confirmed this dish is actually served here

Dish cards on the profile must visually distinguish:
- Dishes with `verifiedAt` set (admin confirmed) vs dishes added at submission time
- Dishes with `availabilityStatus = ALWAYS_AVAILABLE` vs `UNKNOWN` or `WEEKEND_ONLY`

### 4.3 Direct URL Access

Users may arrive at a restaurant profile directly (deep link, search engine, shared URL). The profile must be fully meaningful without search context. No state from a prior search query is required.

### 4.4 SEO Deep Links

Every restaurant profile is a crawlable, indexable page. The route is `/restaurants/[slug]`. The slug is the permanent identifier of the listing. Search engines index the dish names listed on the profile, compounding SEO value with every verified dish added.

---

## 5. RESTAURANT LISTING WORKFLOW

The lifecycle of a restaurant record as it relates to the listing system:

```
DRAFT         → Not visible on any public route
PENDING_REVIEW → Not visible on any public route
NEEDS_INFO    → Not visible on any public route
REJECTED      → Not visible on any public route (even if previously APPROVED)
APPROVED      → Public profile live at /restaurants/[slug]
```

### 5.1 The Listing Gate

The listing system only serves restaurants where `verificationStatus = 'APPROVED'`. This is enforced at the API layer, not as a UI filter. A route handler that fetches a restaurant by slug must check `verificationStatus = APPROVED` as part of the query — not as a post-fetch conditional.

If a slug resolves to a restaurant that exists but is not `APPROVED`, the response is a `404 Not Found`. The existence of the restaurant record must not be disclosed. This prevents reconnaissance of the submission pipeline.

### 5.2 Post-Approval Status Changes

If an admin transitions an `APPROVED` restaurant to `NEEDS_INFO` or `REJECTED` (possible per the state machine), the restaurant immediately disappears from the public profile route and from all search results. There is no grace period and no cached "approved" state on the consumer surface. The `verificationStatus` on `Restaurant` is the live gate.

### 5.3 What Makes a Listing Complete

A listing is considered complete (full score band: Excellent) when all seven confidence signals are met (score = 1.000). A listing is minimally viable (approved, displayable) at score ≥ 0.400.

The listing system must display listings across the full score range from 0.400 to 1.000, presenting trust signals accurately regardless of completeness. A 0.400-score listing must not be hidden — it was approved by a human admin. But its score band label must reflect its completeness.

---

## 6. TRUST SIGNAL PRESENTATION

### 6.1 Hierarchy of Trust Signals

Trust signals are presented to consumers in order of emotional impact and comprehensibility. Technical details are for admin surfaces. Consumer trust is communicated through human-readable indicators.

| Signal | Consumer Presentation | Admin Source |
|---|---|---|
| Verification status | "Verified" badge (green pill, always visible) | `verificationStatus = APPROVED` |
| Score band | Qualitative label: Excellent / Strong / Acceptable / Approved | Confidence score range (see §7.2) |
| Verified photos | Photos shown in the gallery are admin-verified (`isVerified = true`) | `RestaurantPhoto.isVerified` |
| Verified dishes | Dish cards show a "Confirmed" indicator | `RestaurantDish.verifiedAt IS NOT NULL` |
| Phone number | Tappable, actionable link — presence signals reachability | `Restaurant.phone` |
| Address | Structured, copy-able address — specificity signals legitimacy | `Restaurant.address`, `city`, `area` |

### 6.2 Trust Signal Rules for Consumer UI

- The verified badge is **always present** on an approved listing. It is never optional or hidden.
- The badge must always use `green-500` background, `neutral-0` text, and `radius-full` shape — per design system §10.4.
- The score band label (not the raw score) is the consumer-facing trust indicator. Consumers never see `0.750`. They see `Strong`.
- The confidence score numeric value is an admin-only data point. It must never appear in any consumer-facing component.
- Unverified photos are never shown to consumers. Only photos where `isVerified = true` appear in the public gallery. If no verified photo exists, a consistent empty state is shown (see §8.3).
- A dish appears on the consumer profile regardless of whether it has been admin-verified (`verifiedAt`). However, only dishes with `verifiedAt IS NOT NULL` receive a "Confirmed" indicator. Unverified dishes are still displayed — they were submitted by the restaurant owner — but receive no confirmation badge.

### 6.3 What Trust Signals Must NOT Communicate

- Relative ranking compared to other restaurants ("Lagos's #1 Jollof Rice")
- User review counts or star ratings (not in Phase 1)
- Platform-internal quality tiers not visible to users (A-tier, B-tier, etc.)
- Comparison with competing restaurants on the same page

---

## 7. CONFIDENCE SCORE PRESENTATION

### 7.1 Dual Context: Consumer vs Admin

The confidence score serves different purposes in different contexts:

| Context | What is shown | Who sees it |
|---|---|---|
| Consumer profile page | Score band label only (e.g., "Excellent") | All visitors |
| Consumer search result card | Simplified verified badge (no band label) | All visitors |
| Admin queue | Numeric score (JetBrains Mono) + band label | ADMIN, SUPER roles |
| Admin review screen | Full signal breakdown widget | ADMIN, SUPER roles |
| Admin intelligence screen | Full signal breakdown widget with edit affordances | ADMIN, SUPER roles |

Track 3 covers the consumer contexts. Admin contexts were delivered in Track 2.

### 7.2 Score Band Labels (Consumer-Facing)

| Band | Range | Consumer Label |
|---|---|---|
| Very High | 0.900 – 1.000 | Excellent |
| High | 0.700 – 0.899 | Strong |
| Medium | 0.500 – 0.699 | Verified |
| Low | 0.400 – 0.499 | Verified |

Notes:
- "Verified" is used for both Medium and Low bands at the consumer level. The distinction between 0.500 and 0.400 listings is an admin-level concern. Consumers should not see a lower-quality label on an admin-approved listing.
- Scores below 0.400 never appear on consumer surfaces (approval gate enforces this).
- The label "Incomplete" and "Marginal" (used in admin band display) must never appear on consumer surfaces.

### 7.3 Score Band Visual Treatment

Score band labels appear as a secondary line beneath the verified badge on the restaurant profile page header. On search result cards, only the badge appears (no band label — space is too constrained).

The visual treatment of the label is a small `text-sm` string in `green-700`, sitting beneath the green verified badge. It does not have its own background — it is plain text that reads as supplementary information.

### 7.4 Score Must Not Be Inferred From Visual Hierarchy

The visual size, photo quality, and placement of listings on the search results page is governed by FTS relevance to the query, not by confidence score alone. A 0.750-score restaurant that perfectly matches the dish query must rank above a 1.000-score restaurant that is a weaker dish match. The score is a tiebreaker and a secondary ranking signal — it is not the primary sort key for search results.

---

## 8. PHOTO GALLERY EXPERIENCE

### 8.1 Principles

Photography is the primary trust signal for food discovery. The photo experience on the restaurant profile page must be treated as a first-class product feature, not a decoration.

Rules from design system Appendix B apply without exception:
- All photos use `object-cover` — never `object-contain`
- No filters or colour overlays on food photos
- A subtle bottom gradient is permitted on the hero image for text legibility only: `linear-gradient(to top, rgba(26,23,20,0.6) 0%, transparent 60%)`
- No stock photography, no artificially styled food, no over-filtered images

### 8.2 Photo Roles

Each restaurant's photos have roles defined by `RestaurantPhoto` fields:

| Field | Role | Consumer Behaviour |
|---|---|---|
| `isPrimary = true` | Hero photo | Displayed as the full-width hero image at the top of the profile. There is exactly one primary photo per restaurant. |
| `isVerified = true, isPrimary = false` | Gallery photos | Shown in the scrollable photo gallery section |
| `isVerified = false` | Unverified | Never shown to consumers under any circumstances |

### 8.3 Gallery Layout (Design System §10.10 Reference)

The photo gallery section below the hero:

- **Mobile:** Full-width single-column swipe gallery (horizontal scroll, snap-to-card)
- **Tablet:** 2-column grid
- **Desktop:** 3-column grid with `radius-xl` (16px) on each cell

Each photo cell is a 1:1 aspect ratio square. `object-cover`. No captions on consumer profile (caption is an admin-only field). No action overlays — consumers view only.

When tapped/clicked on mobile, the photo opens in a full-screen lightbox (full viewport, black background, swipe to navigate, tap to close).

### 8.4 Empty State — No Verified Photos

If a restaurant has zero verified photos (possible for listings at the low end of the score band), the hero section displays a structured empty state consistent with design system §15:

- Icon: Camera outline (Lucide `Camera`, 48px, `neutral-300`)
- Headline: `text-2xl`, Fraunces, `neutral-700`: "Photos coming soon"
- Body: `text-base`, Plus Jakarta Sans, `neutral-500`: "This restaurant hasn't had photos verified yet."
- No CTA (no action available to a consumer)

The empty state replaces the hero image only. The rest of the profile (name, details, dishes) is still displayed normally.

### 8.5 Hero Image Requirements

- Aspect ratio: 16:9 on desktop, 3:2 on mobile (not square)
- Width: 100% of the content column on desktop; 100% viewport width on mobile
- The restaurant name is overlaid on the hero image (bottom-left) using the bottom gradient treatment
- Overlay content: Restaurant name (Fraunces, `text-4xl` on desktop / `text-2xl` on mobile, `neutral-0`, `font-bold`) + verified badge

### 8.6 Photo Count Indicator

A subtle count badge ("1 / 4") appears in the top-right corner of the gallery when more than one photo exists and the gallery is in scroll mode. This follows the design system's `text-xs`, `neutral-0` on `rgba(0,0,0,0.5)` background pattern.

---

## 9. NEARBY RANKING REQUIREMENTS

### 9.1 Phase 1 Geo Model

Track 3 uses the same geo model defined in `search-architecture.md §5`. No GPS coordinates, no PostGIS, no distance computation. Location awareness is structured text only:

| Field | Type | Use in Track 3 |
|---|---|---|
| `Restaurant.city` | String | Primary geo filter |
| `Restaurant.state` | String | Secondary context label |
| `Restaurant.area` | String (nullable) | Neighbourhood context on profile |
| `Restaurant.address` | String | Full address display |

### 9.2 Ranking on the Search Results Page (Context for Track 3)

The ranking model governing search result order (Track 4) is:

```
final_score = (
  fts_rank           * 0.40   — full-text relevance to dish query
  confidence_score   * 0.35   — restaurant trust score
  availability_bonus * 0.15   — dish availability status
  recency_bonus      * 0.10   — recently verified or updated
)
```

Track 3 does not build search ranking logic. However, the Restaurant Profile Page must display information that makes the ranking comprehensible to users — i.e., the factors that make a restaurant appear high in results (verification, dish availability) should be visible and legible on the profile.

### 9.3 City Filtering

When search results are filtered by city, only restaurants in that city are shown. The profile page displays the city and area prominently, so users who arrive from a city-filtered search can confirm they are viewing the right location.

### 9.4 Area Display

`Restaurant.area` (e.g., "Lekki Phase 1", "Surulere", "Wuse 2") is displayed on the profile page below the city name as a secondary location refinement. This is important in Nigerian cities where "Lagos" without an area designation is too coarse to be useful.

### 9.5 No Latitude/Longitude in Phase 1

The schema does not contain `latitude` or `longitude` fields in Phase 1. These are Phase 2 additions. The listing page must not show a map pin, a "X km away" distance, or any GPS-dependent feature. See §10 (Location and Map Requirements) for the compatible approach.

---

## 10. LOCATION AND MAP REQUIREMENTS

### 10.1 Phase 1 Location Display

The profile page displays location as structured text:

1. **Area** — `text-base`, `neutral-700`: "Lekki Phase 1" (if present)
2. **Address** — `text-base`, `neutral-600`: full street address
3. **City, State** — `text-base`, `neutral-500`: "Lagos, Lagos State"

These three lines appear in the location section below the restaurant name and badges. The location section uses a `MapPin` Lucide icon (`neutral-500`, 16px) to the left of the first line.

### 10.2 No Map Embed in Phase 1

No map component, iframe, or external map SDK is embedded on the restaurant profile page in Phase 1. The address is displayed as readable, copy-able text only.

Reasons:
- GPS coordinates are not available (Phase 1 schema does not include them)
- Embedding a third-party map (Google, Mapbox) without coordinate precision would display an inaccurate pin
- A custom map aesthetic requires lat/lng and the Phase 2 custom map style (design system §14.2)
- Third-party map embeds add a performance dependency that is not justified in Phase 1

### 10.3 Address Actions

On mobile, the address is displayed as a tappable element that opens the device's native maps application (using the `geo:` URI scheme or a Google Maps/Apple Maps deep link with the address as a text query — not coordinates). This is the acceptable Phase 1 navigation bridge. It does not constitute "in-product navigation."

```
<a href="https://maps.google.com/?q={encodeURIComponent(address + ', ' + city)}" 
   target="_blank" 
   rel="noopener noreferrer">
  {address}
</a>
```

This is the **only** external navigation affordance permitted in Phase 1. No other map or navigation CTA may be added.

### 10.4 Future Navigation Compatibility Requirements

Per design system §14.3, the following Phase 1 decisions are mandatory to preserve the Phase 2 navigation path:

| Requirement | Enforcement |
|---|---|
| `Restaurant.address`, `city`, `state`, `area` are present and populated | Schema already enforces this; Track 3 must display all four |
| URL structure for restaurant pages uses `/restaurants/[slug]` | This slug becomes the Phase 2 navigation deep-link anchor |
| Consumer page layout must not use fixed-height containers that would prevent adding a map panel | All layout containers must use responsive min-height, not fixed height |
| No hardcoded heights on the hero, profile, or dish sections | Use `min-h-*` or intrinsic sizing, never `h-[Npx]` fixed |

---

## 11. FUTURE NAVIGATION COMPATIBILITY

### 11.1 The Navigation Vision

The long-term product vision (project-status-v1.md §17, design-system-v1.md §14) defines a full in-product navigation flow:

```
Dish Search
  → Restaurant Match
  → Distance Ranking
  → Route Preview
  → Turn-by-Turn Navigation (in-product, not handed off to a third party)
  → Real-Time Tracking
  → Arrival Confirmation → quality signal loop
```

Track 3 implements steps 1–2 (match and profile display). Steps 3–7 are Phase 2+.

### 11.2 What Track 3 Must Preserve

Track 3 must make zero decisions that foreclose the navigation path. These are the concrete constraints:

**1. Slug permanence.** The restaurant slug (`/restaurants/[slug]`) must be the permanent, stable public identifier. Slugs must never be auto-regenerated after a restaurant is approved. The slug is the deep-link anchor for future navigation handoff.

**2. Location field completeness.** The profile page must surface all location fields — even if Phase 1 cannot draw a map, the data must be accessible and visible. A future feature cannot add map functionality if the fields are conditionally omitted from the API response or the component.

**3. Layout flexibility.** The profile page layout must be designed with a map panel insertion point in mind. On mobile, a sticky "Directions" or "Navigate" CTA at the bottom of the screen is the intended Phase 2 entry point. Phase 1 uses the address-to-maps-app link (§10.3) in that same visual position.

**4. Arrival confirmation hook.** The long-term system closes the loop with an arrival confirmation that feeds quality signals back into the intelligence layer. Track 3 must not build or simulate this (it requires GPS + background tracking), but must not place any UI element that would prevent its future insertion.

### 11.3 What Track 3 Must NOT Pretend to Deliver

- No fake "X km away" distance that is not computed from real GPS data
- No map that shows an approximate pin based on city name alone
- No "Navigate" CTA that links to an external app and calls it navigation — the one external link in §10.3 is deliberately positioned as a utility, not a product feature
- No "Directions" button that triggers a native maps deep link and presents itself as in-product navigation

---

## 12. API BOUNDARIES

### 12.1 New Routes Required

Track 3 requires the following new API routes:

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/restaurants/:slug` | None | Full restaurant profile for consumer display |
| `GET` | `/api/v1/restaurants/:slug/dishes` | None | Paginated dish list for a restaurant |
| `GET` | `/api/v1/restaurants` | None | Listing index — paginated, city-filtered, for SEO and browse |

These routes serve the consumer public. No authentication is required. Rate limiting applies.

### 12.2 Route: GET /api/v1/restaurants/:slug

**Query:** Fetches a restaurant by slug where `verificationStatus = APPROVED` and `deletedAt IS NULL`. Returns `404` if the slug does not exist or the restaurant is not `APPROVED` — no distinction between "does not exist" and "not approved."

**Response shape:**

```typescript
interface RestaurantProfileResponse {
  id: string
  name: string
  slug: string
  description: string | null
  phone: string
  address: string
  area: string | null
  city: string
  state: string
  priceRange: PriceRange
  cuisineTypes: string[]
  website: string | null
  email: string | null
  confidenceScoreBand: 'EXCELLENT' | 'STRONG' | 'VERIFIED'  // consumer-safe band, never raw score
  verificationBadge: 'VERIFIED'                               // always VERIFIED if this response is returned
  photos: {
    id: string
    url: string
    isPrimary: boolean
    // isVerified not returned — consumer response only includes isVerified=true photos
  }[]
  dishes: {
    id: string
    canonicalName: string
    nameAsServed: string | null
    availabilityStatus: DishAvailabilityStatus
    price: Decimal | null
    isAdminVerified: boolean    // true if verifiedAt IS NOT NULL — consumer label: "Confirmed"
    category: DishCategory
  }[]
  submittedAt: string  // ISO-8601; when the restaurant was first submitted (createdAt)
  approvedAt: string   // ISO-8601; when the last APPROVED transition occurred
}
```

**Mandatory exclusions from the response:**
- Raw `confidenceScore` numeric value — consumers receive the band label only
- `VerificationRecord` fields (internalNotes, feedbackToSubmitter, assignedTo, etc.)
- `VerificationEvent` history
- Photos where `isVerified = false`
- `deletedAt`, `verificationStatus` fields
- Any admin-internal data

### 12.3 Route: GET /api/v1/restaurants/:slug/dishes

Returns the full dish list for a restaurant (paginated at 20 per page). Same dish shape as the embedded list in the profile response, but paginated for restaurants with large dish inventories.

Query params: `page` (default 1), `limit` (max 20, default 20), `category` (optional `DishCategory` filter).

### 12.4 Route: GET /api/v1/restaurants

For browse and SEO index pages. Paginated, city-filtered list of approved restaurants.

Query params: `city` (optional), `page` (default 1), `limit` (max 20, default 12), `priceRange` (optional).

**Response shape:** Abbreviated restaurant card data (not full profile). Includes: `id`, `name`, `slug`, `city`, `area`, `priceRange`, `cuisineTypes`, `confidenceScoreBand`, `thumbnailUrl` (primary photo URL), `dishCount`.

### 12.5 Rate Limiting

All three routes are public (no auth required). Rate limits:

| Route | Limit | Window |
|---|---|---|
| `GET /api/v1/restaurants/:slug` | 120 / IP / minute | Standard page load |
| `GET /api/v1/restaurants/:slug/dishes` | 60 / IP / minute | Pagination |
| `GET /api/v1/restaurants` | 60 / IP / minute | Browse/index |

Rate limits are enforced via the existing PostgreSQL-backed `rate-limit.ts` infrastructure.

### 12.6 Caching Strategy

Restaurant profile pages are relatively stable (change only when an admin updates intelligence data or changes status). Server-side rendering with Next.js `revalidate` is the correct approach.

| Route | Cache strategy | Revalidation |
|---|---|---|
| `/restaurants/[slug]` | SSR + `revalidate: 300` (5 minutes) | On status change or intelligence update (future: on-demand revalidation) |
| `/restaurants` (index) | SSR + `revalidate: 300` | On new restaurant approved |

Phase 1 uses time-based revalidation. On-demand revalidation (via `revalidatePath` triggered by admin actions) is a Track 6 enhancement.

### 12.7 SEO Metadata API Contract

The restaurant profile page must generate the following metadata for each listing:

```typescript
// Generated in page.tsx via generateMetadata()
metadata = {
  title: `${restaurant.name} — Verified Nigerian Restaurant in ${restaurant.city} | Chow Here`,
  description: restaurant.description?.slice(0, 160) ?? `${restaurant.name} is a verified Nigerian restaurant in ${restaurant.city}.`,
  openGraph: {
    title: restaurant.name,
    description: ...,
    images: [{ url: primaryPhotoUrl, width: 1200, height: 630, alt: restaurant.name }],
    type: 'restaurant.restaurant',
    siteName: 'Chow Here',
  },
  twitter: {
    card: 'summary_large_image',
    title: ...,
    description: ...,
    images: [primaryPhotoUrl],
  },
  alternates: {
    canonical: `${NEXT_PUBLIC_APP_URL}/restaurants/${restaurant.slug}`,
  },
}
```

Structured data (JSON-LD `Restaurant` schema) must also be injected into the page `<head>`:

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "...",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "...",
    "addressLocality": "...",
    "addressRegion": "...",
    "addressCountry": "NG"
  },
  "telephone": "...",
  "url": "...",
  "servesCuisine": ["Nigerian"],
  "image": "..."
}
```

---

## 13. UI BOUNDARIES

### 13.1 Routes Delivered by Track 3

| Route | Type | Description |
|---|---|---|
| `/restaurants/[slug]` | Dynamic page (SSR) | Full restaurant profile |
| `/restaurants` | Static + ISR | Browse index — all verified restaurants, city-filtered |

Track 3 does not deliver:
- `/search` or any search UI (Track 4)
- `/submit` intake form (Track 2 — already partially scoped)
- `/dashboard/saved` or user-specific views (Track 5)
- Any admin routes (Track 2)

### 13.2 Restaurant Profile Page — Component Structure

The restaurant profile page is composed of these sections, in order (mobile-first, scrolling):

**1. Hero Section**
- Full-width photo (16:9 desktop, 3:2 mobile), `object-cover`
- Gradient overlay (bottom-left to transparent)
- Restaurant name overlay: Fraunces, `text-4xl` (desktop) / `text-2xl` (mobile), `neutral-0`, `font-bold`
- Verified badge overlay: bottom-left, above name, green pill

**2. Restaurant Identity Section**
- Restaurant name (repeated below hero for non-visual users and SEO): Fraunces, `text-3xl` desktop / `text-2xl` mobile, `neutral-900`, `font-bold`
- Score band label (small, `text-sm`, `green-700`)
- Cuisine type tags (pill badges, `neutral-100` fill, `text-sm`)
- Price range badge

**3. Location Section**
- MapPin icon + area/address/city display (see §10.1)
- Address as tappable link on mobile (see §10.3)

**4. Dishes Section**
- Section heading: "What they serve" (`text-2xl`, Fraunces, `neutral-800`)
- Horizontal scrollable chip list: canonical dish names, amber pill style
- Expanded dish card grid below: dish name, availability status badge, price if known, "Confirmed" indicator if `verifiedAt IS NOT NULL`
- Empty state: per design system §15.2 ("No dishes listed yet")

**5. Contact Section**
- Phone number: large, tappable (`tel:` href on mobile), `text-lg`, `amber-500`, `font-semibold`
- Website link: if present, external link (Lucide `ExternalLink` icon)
- Email: if present

**6. Photo Gallery Section**
- Section heading: "Photos" (`text-xl`, Plus Jakarta Sans, `neutral-800`)
- Grid of verified photos (see §8.3)
- Lightbox on tap/click

**7. About Section**
- Section heading: "About" (`text-xl`, Plus Jakarta Sans, `neutral-800`)
- Description text: `text-md`, `neutral-700`, `max-w-prose`
- Empty state: omit the section entirely if `description` is null or fewer than 10 characters

### 13.3 Restaurant Browse Index Page — Component Structure

The `/restaurants` page presents a filtered, paginated grid of restaurant cards.

- Page heading: Fraunces, `text-4xl`, "Nigerian Restaurants" or city-specific "Nigerian Restaurants in Lagos"
- City filter: tab bar or select dropdown (cities with at least one approved restaurant)
- Restaurant card grid: 2 columns mobile, 3 columns tablet, 4 columns desktop
- Pagination: page numbers, previous/next, `text-sm`, `neutral-600`
- Empty state for filtered view: "No verified restaurants in [city] yet."

### 13.4 Restaurant Card (Consumer) — Exact Design System Reference

Per design system §10.3:

```
Surface:    neutral-0
Radius:     radius-xl (16px) — standard / radius-3xl (28px) — featured cards only
Shadow:     shadow-sm (resting), shadow-DEFAULT (hovered)
Hover:      translateY(-2px), 200ms ease-out
Padding:    space-5 (20px) inside content area
Photo:      Aspect ratio 4:3, radius-xl top corners, object-cover
```

Structure (top to bottom):
1. Photo block — full width, 4:3 ratio, `object-cover`, `radius-xl` top corners
2. Verified badge — overlaid on photo, bottom-left, green pill (`green-50` background, `green-700` text)
3. Restaurant name — Fraunces, `text-2xl`, `font-semibold`, `neutral-900`
4. Cuisine type tags — pill row, `neutral-100` fill, `text-sm`, `neutral-700`
5. Location line — Lucide `MapPin` icon + city/area, `text-sm`, `neutral-600`
6. Consumer does NOT see confidence score number — verified badge is sufficient

### 13.5 Shared Components Delivered by Track 3

| Component | Location | Used By |
|---|---|---|
| `RestaurantCard` | `features/restaurants/components/RestaurantCard.tsx` | Browse index, search results (Track 4 consumes) |
| `RestaurantHero` | `features/restaurants/components/RestaurantHero.tsx` | Profile page |
| `DishCard` (consumer) | `features/restaurants/components/DishCard.tsx` | Profile page dish section |
| `PhotoGallery` | `features/restaurants/components/PhotoGallery.tsx` | Profile page photo section |
| `PhotoLightbox` | `features/restaurants/components/PhotoLightbox.tsx` | Profile page — full-screen photo viewer |
| `TrustBadge` | `features/restaurants/components/TrustBadge.tsx` | Verified badge + score band label |
| `RestaurantContactSection` | `features/restaurants/components/RestaurantContactSection.tsx` | Profile page contact block |

`RestaurantCard` must be built to serve Track 4 (search results). It receives a truncated restaurant shape and must work without full profile data.

### 13.6 What Shared Components From Track 2 Are Reused

Track 3 does not rebuild components already delivered in Track 2:

| Component | Source | Used in Track 3 |
|---|---|---|
| `VerificationStatusBadge` | `features/verification/components/` | Not used on consumer surfaces — `TrustBadge` replaces this for consumers |
| `Button`, `Badge`, `Skeleton`, `Dialog` | `components/ui/` | Used throughout Track 3 pages |
| `apiGet`, `apiGetPaginated` | `src/lib/api.ts` | Used by client-side hooks for dish pagination |

### 13.7 Loading States

Per design system §16.3:

| Context | Skeleton pattern |
|---|---|
| Restaurant profile hero | Full-width photo block (16:9) + name text block |
| Restaurant identity section | Name line (70% width), two tag rows |
| Dish section | 4 dish card skeletons |
| Photo gallery | 3 photo cell skeletons (1:1 ratio) |
| Browse card grid | 8 restaurant card skeletons (photo block + 2 text lines each) |

Skeleton delay: 200ms before skeletons appear (per design system §16.1 — do not flash skeletons for fast loads).

---

## 14. DATABASE INTERACTIONS

### 14.1 Queries Required

Track 3 introduces new read-access patterns on the existing schema. No schema migrations are required for Track 3. All required fields already exist.

**Query 1 — Fetch restaurant profile by slug:**

```
SELECT Restaurant (all fields except: verificationStatus, deletedAt, searchVector)
  WHERE slug = :slug
    AND verificationStatus = 'APPROVED'
    AND deletedAt IS NULL
JOIN RestaurantPhoto
  WHERE restaurantId = restaurant.id
    AND isVerified = true
  ORDER BY isPrimary DESC, createdAt ASC
JOIN RestaurantDish (with DishTaxonomy)
  WHERE restaurantId = restaurant.id
    AND deletedAt IS NULL
  ORDER BY verifiedAt IS NOT NULL DESC, createdAt ASC
```

**Query 2 — Fetch restaurant browse index:**

```
SELECT Restaurant (abbreviated: id, name, slug, city, area, priceRange, cuisineTypes, confidenceScore, thumbnailUrl)
  WHERE verificationStatus = 'APPROVED'
    AND deletedAt IS NULL
    AND (:city IS NULL OR city ILIKE :city)
  ORDER BY confidenceScore DESC, approvedAt DESC
  LIMIT :limit OFFSET :offset
```

`thumbnailUrl` is derived from the first `RestaurantPhoto` where `isPrimary = true AND isVerified = true`. If none exists, the field is `null`.

**Query 3 — Paginated dish list for a restaurant:**

```
SELECT RestaurantDish JOIN DishTaxonomy
  WHERE restaurantId = :restaurantId
    AND deletedAt IS NULL
    AND (:category IS NULL OR DishTaxonomy.category = :category)
  ORDER BY verifiedAt IS NOT NULL DESC, createdAt ASC
  LIMIT :limit OFFSET :offset
```

### 14.2 Performance Considerations

All three queries rely on existing indexes. No new indexes are required for Phase 1 Track 3 scale.

| Query | Index Used |
|---|---|
| Profile by slug | `idx_restaurant_slug` (unique) |
| Browse index | `idx_restaurant_verification_status`, `idx_restaurant_city` (partial) |
| Dish list | `idx_restaurant_dish_restaurant_id` |

The partial index on `(verificationStatus)` WHERE `verificationStatus = 'APPROVED'` ensures browse queries only scan the APPROVED subset, which is the smallest subset in the pipeline.

### 14.3 The `thumbnailUrl` Derivation

`Restaurant.thumbnailUrl` (a stored field) should be kept in sync with the primary verified photo. The Track 3 API reads `thumbnailUrl` from the `Restaurant` record for the browse index. The full profile page fetches the full photo array independently.

`thumbnailUrl` is set by the admin intelligence service when a photo is marked as primary (`isPrimary = true`). Track 3 reads it as a cached value — it does not compute it. If `thumbnailUrl` is null (no primary photo has been set), the browse card renders the empty photo state.

### 14.4 No Schema Changes

Track 3 does not modify `prisma/schema.prisma`. All required fields exist:

| Field | Model | Status |
|---|---|---|
| `slug` | `Restaurant` | Exists |
| `name`, `description`, `phone`, `address`, `city`, `state`, `area` | `Restaurant` | Exists |
| `priceRange`, `cuisineTypes`, `website`, `email` | `Restaurant` | Exists |
| `confidenceScore` | `Restaurant` | Exists |
| `verificationStatus` | `Restaurant` | Exists |
| `thumbnailUrl` | `Restaurant` | Exists |
| `isVerified`, `isPrimary`, `url` | `RestaurantPhoto` | Exists |
| `verifiedAt`, `nameAsServed`, `availabilityStatus`, `price` | `RestaurantDish` | Exists |
| `canonicalName`, `aliases`, `category` | `DishTaxonomy` | Exists |

If any new field is found to be necessary during implementation, it must be:
1. Reviewed against the architecture governance documents
2. Added to `database-track.md` before the Prisma migration
3. Migrated and seeded before the API layer uses it

---

## 15. SUCCESS METRICS

### 15.1 Functional Completeness

| Metric | Target | Verification |
|---|---|---|
| All approved restaurants have a live, accessible profile page | 100% | Manual check + automated smoke test |
| Non-approved restaurants return 404 (not 200, not 403) | 100% | Test suite |
| Only `isVerified = true` photos appear on consumer profiles | 100% | Test suite |
| Raw confidence score never appears in any consumer API response | 100% | API contract test |
| Score band labels map correctly to score ranges | 100% | Unit test |
| Profile pages have valid JSON-LD structured data | 100% | Lighthouse structured data check |
| OpenGraph metadata renders correctly on social preview | 100% | Manual spot check |

### 15.2 Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Restaurant profile page — Time to First Byte (TTFB) | < 200ms | Vercel analytics |
| Restaurant profile page — Largest Contentful Paint (LCP) | < 2.5s | Core Web Vitals |
| Cumulative Layout Shift (CLS) | < 0.1 | Core Web Vitals |
| Photo gallery — first photo visible | < 1.5s on 4G | Lighthouse |
| Browse index — initial load | < 1.0s TTFB | Vercel analytics |

### 15.3 SEO Targets (Baseline, Not Launch Metrics)

| Metric | Target |
|---|---|
| Every profile page is indexable (no `noindex`) | Yes |
| Every profile page has a canonical URL | Yes |
| Every profile page has a unique `<title>` | Yes |
| Every profile page has a unique meta description | Yes |
| Structured data validates with no errors | Yes (validated with Google Rich Results Test) |

### 15.4 Trust Metric

The trust metric for Track 3 is simple: no consumer should be able to see an unverified, pending, or rejected restaurant under any circumstances. This is a binary metric: either it is enforced, or it is not.

Enforcement is verified by the test suite (§12.1 API contract) and by a manual audit after deployment.

---

## 16. RISKS AND EDGE CASES

### 16.1 Status Transitions and Live Profiles

**Risk:** A restaurant that is `APPROVED` and publicly visible could be transitioned to `NEEDS_INFO` or `REJECTED` by an admin while a user is viewing its profile.

**Resolution:** The profile page revalidates at 5-minute intervals. A user viewing a cached profile of a restaurant that was just un-approved will see it for up to 5 minutes. This is an acceptable Phase 1 trade-off — it is better than introducing on-demand cache invalidation complexity prematurely. The page will be stale at most 5 minutes.

**Out of scope:** Real-time invalidation via WebSocket push. Phase 2 enhancement.

### 16.2 Slug Collisions

**Risk:** Two restaurants with identical or near-identical names in the same city could generate the same slug.

**Resolution:** `slug.service.ts` already handles slug uniqueness — if "kings-palace" is taken, it generates "kings-palace-1". This is a Track 2 concern already resolved. Track 3 reads slugs; it does not generate them.

### 16.3 No Verified Photos at Launch

**Risk:** A restaurant may be approved with score ≥ 0.400 but with zero verified photos (S2 signal not earned). This is a valid state.

**Resolution:** The empty photo state (§8.4) handles this gracefully. The listing remains visible and useful (phone + address + dishes). The admin can verify photos at any time without requiring re-approval.

### 16.4 Long Dish Lists

**Risk:** A restaurant may have many dishes, making the profile page slow to load or hard to navigate.

**Resolution:** Dishes are paginated on the server (20 per initial load). The client can load more via the `/api/v1/restaurants/:slug/dishes` endpoint. The category filter allows consumers to narrow the dish list. This is handled in the API design (§12.3).

### 16.5 Missing or Short Descriptions

**Risk:** A restaurant with a very short or missing description creates an awkward layout gap in the About section.

**Resolution:** The About section is conditionally rendered — if `description` is null or fewer than 10 characters, the section is omitted entirely. The page layout must handle this gracefully without layout shift.

### 16.6 Deleted Restaurants

**Risk:** A restaurant record with `deletedAt IS NOT NULL` (soft-deleted) could be accessible via a bookmarked or indexed URL.

**Resolution:** All queries include `AND deletedAt IS NULL`. A soft-deleted restaurant returns `404`. This is the same behaviour as a non-approved restaurant — no distinction is disclosed.

### 16.7 SEO Re-indexing After De-listing

**Risk:** A restaurant that was `APPROVED` (and indexed by Google) is later `REJECTED`. The Google index still shows the URL for up to weeks.

**Resolution:** When a cached profile URL returns `404`, Google eventually de-indexes it. The `404` response must include `X-Robots-Tag: noindex` in the response header for this case. This is handled in the route handler for the 404 branch.

### 16.8 Cuisine Types as Free-Form vs Taxonomy

**Risk:** `Restaurant.cuisineTypes` is a `String[]` field (array of strings), not a foreign key to a taxonomy table. Values may be inconsistent ("Nigerian", "West African", "Pan-Nigerian").

**Resolution:** In Phase 1, cuisine types are displayed as-is from the database. No normalisation is applied. Standardisation of cuisine type taxonomy is a Track 6 (admin platform) concern. Track 3 must not attempt to normalise or validate these values at render time.

### 16.9 Photos From Rejected Restaurants (Cloudinary Cleanup)

**Risk:** Photos uploaded to Cloudinary for a rejected restaurant are never deleted, causing storage cost accumulation.

**Resolution:** Photo cleanup for rejected restaurants is a Track 6 operational concern. Track 3 never deletes photos. This is logged as a known technical debt item but does not affect Track 3 functionality.

---

## 17. MOBILE-FIRST REQUIREMENTS

### 17.1 Core Principle

Every component in Track 3 is designed for mobile first. The primary consumer of this product is a mobile user in Nigeria. Desktop is an enhancement, not the default. A design that only works at desktop width is not finished.

This is governed by design system §9.1.

### 17.2 Breakpoint Targets

| Breakpoint | Min Width | Profile Page Behaviour |
|---|---|---|
| `xs` | 0px | Single column, full-width hero, stacked sections |
| `sm` | 480px | Minor padding adjustments |
| `md` | 640px | 2-column photo gallery, name text scale up |
| `lg` | 1024px | Sidebar layout: photo+name left, details right |
| `xl` | 1280px | Max content width reached |

### 17.3 Bottom Navigation (Consumer Mobile)

Per design system §9.4, the consumer mobile experience uses a bottom navigation bar (≤ `lg` breakpoint). Track 3 must integrate with this bottom navigation. The bottom nav items for consumer context:

| Item | Icon | Route |
|---|---|---|
| Discover | Home (Lucide `House`) | `/` (home page, Track 4) |
| Search | Search (Lucide `Search`) | `/search` (Track 4) |
| Saved | Bookmark (Lucide `Bookmark`) | `/dashboard/saved` (Track 5) |
| Profile | User (Lucide `User`) | `/dashboard` (Track 5) |

Track 3 does not build the search or user routes. The bottom nav is built in Track 3 as the persistent consumer navigation shell — it renders as-is on the profile and browse pages, with disabled/placeholder states for routes not yet implemented.

### 17.4 Touch Targets

All interactive elements on the profile page must meet the minimum touch target sizes from design system §8.5:

- Phone number tap target: minimum 44×44px
- Address tap target (external maps link): minimum 44×44px
- Dish card: minimum 48px height
- Photo cell: minimum 80×80px

### 17.5 Hero Image on Mobile

On mobile (< `lg` breakpoint):
- The hero image is 3:2 aspect ratio (shorter than desktop's 16:9)
- The restaurant name overlay text scales down to `text-2xl`
- The gradient is identical (bottom-to-transparent)
- The photo fills 100% of the viewport width (zero horizontal margin)

### 17.6 Restaurant Name Typography on Mobile

Per design system §9.6 (display type scaling):

| Breakpoint | Restaurant Name Size |
|---|---|
| Mobile (`xs`) | `text-2xl` (24px, Fraunces) |
| Tablet (`md`) | `text-3xl` (28px, Fraunces) |
| Desktop (`lg`) | `text-4xl` (32px, Fraunces) |

### 17.7 Dish List on Mobile

The horizontal scrollable chip list (canonical dish names) uses native horizontal scroll with scroll snapping. Chips are `radius-full` pill badges, `amber-50` background, `amber-700` text, `text-sm`.

Below the chip list, the dish card grid is single-column on mobile (full width cards), 2-column on tablet, 3-column on desktop.

### 17.8 Photo Gallery on Mobile

The photo gallery is a full-width horizontal swipe carousel on mobile. Swipe to navigate. Each photo fills 100% of the viewport width. The count indicator (§8.6) is visible in the top-right corner.

On tablet and desktop, the gallery transitions to a grid layout (§8.3).

### 17.9 Safe Area Insets

All pages use the `viewport-fit=cover` meta tag (already set in `app/layout.tsx`). Bottom navigation and sticky elements must use `padding-bottom: env(safe-area-inset-bottom)` to avoid being obscured by the device home indicator on iOS.

---

## 18. ALIGNMENT WITH PRODUCT EXPERIENCE & DESIGN VISION

This section maps every major product vision requirement (project-status-v1.md §17) to Track 3 deliverables.

### 18.1 Brand Philosophy Alignment

| Vision Requirement | Track 3 Implementation |
|---|---|
| Dish-first, always | Search bar is the hero on all consumer surfaces (Track 4 builds the bar; Track 3 receives users from it). Dish section appears before contact/about on the profile. |
| Photography is substance | Hero image is the first thing users see. It is full-width, never cropped to a thumbnail. Only admin-verified photos appear. |
| Trust signals are quiet | Verified badge is prominent but not dominant. Score band label is secondary text, not a large visual element. |
| Scarcity is a feature | Only `APPROVED` listings render. There is no "pending" or "unverified" visible tier. |
| Location is ambient | City and area are displayed without requiring user input on the profile page. |

### 18.2 Five Brand Feelings

| Feeling | Track 3 Expression |
|---|---|
| **Trust** | Verified badge on every listing. Only verified photos. No raw scores visible to consumers. No unapproved listings. |
| **Warmth** | Fraunces for restaurant names. Amber palette for interactive elements. Nigerian place names displayed as-is. |
| **Confidence** | Strong typographic hierarchy. Clear section structure. No hedging copy ("this listing may not be accurate"). |
| **Nigerian** | Nigerian phone number formatting (0801 format), Naira symbol (₦) for prices, Nigerian city and neighbourhood naming conventions respected. |
| **Premium simplicity** | One hero image. Clean typographic hierarchy. No excessive badges or decorative elements. Information over chrome. |

### 18.3 Consumer Experience Goals

| Goal | Track 3 Coverage |
|---|---|
| Dish-first discovery | Profile surfaces the originating dish prominently. Dish section before contact. |
| Beautiful food presentation | Hero + gallery as primary UI elements. Admin-verified photos only. Design system photography direction enforced. |
| Fast search | Track 4 concern. Track 3 pages must load under 2.5s LCP to not undermine the fast search experience. |
| Clear trust indicators | Verified badge, score band label, "Confirmed" dish indicator, verified photo treatment. |
| Location-aware recommendations | City + area displayed on profile. Address tappable for external navigation. |
| Navigation-first experience | Phase 2. Phase 1 preserves compatibility (§11). |

### 18.4 SEO Infrastructure Alignment

The master architecture (section 2, system 9) lists "SEO Infrastructure" as a Phase 1 system. Track 3 is the primary vehicle for delivering SEO value:

- Every restaurant profile is a unique, indexable URL
- Every page has unique `<title>`, meta description, canonical URL
- JSON-LD structured data on every profile
- OpenGraph metadata for social sharing
- `sitemap.xml` entries for all approved restaurant pages (implementation detail: sitemap generation is a Track 6 system; Track 3 must not build or defer it, but the profile URLs must be structured to be sitemap-compatible)

### 18.5 Animation Standards

Per project-status-v1.md §17 and design system §7:

All animations in Track 3 consumer surfaces must pass all four criteria:
- **Fast** — no interaction animation > 300ms
- **Subtle** — motion is noticed only if absent
- **Purposeful** — every animation communicates state change
- **Premium** — ease-out for entrances, ease-in for exits

Specifically for Track 3:
- Restaurant card hover: `translateY(-2px)`, `200ms ease-out` (per DS §7.4)
- Photo gallery swipe: native scroll with `scroll-behavior: smooth`; no custom animation on the scroll itself
- Lightbox open: `opacity 0→1`, `300ms ease-out` (modal enter per DS §7.4)
- Skeleton shimmer: `1400ms ease-in-out infinite` diagonal gradient (per DS §16.2)
- Staggered card entrance: `40ms` per card, max 6 cards in the stagger chain (per DS §7.5)

### 18.6 Implementation Law Compliance

Track 3 implementation must follow the 10 engineering laws from master-architecture.md §8. The most critical for this track:

- **Law 1 (System Before UI):** API routes and service layer must be built before any React component
- **Law 10 (Incremental Delivery):** Schema → Service → API → UI. Each step is committed and tested before the next begins
- **Law 5 (Strict Types):** No `any` in restaurant profile types. Prisma types own the DB layer
- **Law 8 (Trust is a Feature):** The 404 for non-APPROVED restaurants is not a UX compromise — it is a product requirement

---

## Document Relationships

```
master-architecture.md              ← Governing law (highest authority)
chow-here-design-system-v1.md      ← UI law (all component decisions)
    │
    ├── backend-standards.md        ← API implementation patterns
    ├── frontend-standards.md       ← React component patterns
    ├── security-standards.md       ← Auth, RBAC, input validation
    ├── search-architecture.md      ← Search model (Track 4 consumes)
    └── confidence-scoring-spec.md  ← Score band calculation
    │
    └── restaurant-listing-track.md ← THIS DOCUMENT
            │
            ├── Depends on: track-02-verification-intelligence.md (complete)
            └── Feeds into: search-system-track.md (Track 4)
```

---

*This document is authoritative for Track 3 implementation. No implementation code may be written until this document is reviewed and approved. Changes during implementation require explicit versioning and a note in the changelog below.*

**Changelog:**
- v1.0 — 2026-06-05 — Initial specification

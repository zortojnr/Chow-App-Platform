# Chow Here — Track 7: Navigation & Location Intelligence

**Status:** SPECIFICATION — approved before implementation begins  
**Version:** 1.0  
**Date:** 2026-06-12  
**Governed By:** master-architecture.md · chow-here-design-system-v1.md  
**Depends On:** Track 3 (Restaurant Listing System) — complete · Track 4 (Search & Discovery) — complete  
**Blocked By:** Schema migrations in §14 must be applied before any service code begins  
**Next Track:** Track 8 — Arrival Confirmation & Quality Loop

---

## 0. PURPOSE OF THIS DOCUMENT

This document is the authoritative architecture and product specification for two tightly coupled Phase 2 features:

**Feature A — User Location & Closest Restaurant Discovery**  
Users can grant GPS permission (or manually select a location) and immediately see search results ranked by proximity, with real distances shown on every restaurant card.

**Feature B — Restaurant Map + Real-Time Journey Tracking**  
When a user taps a restaurant, a map panel shows the restaurant pin and the user's live position. As the user travels, their position updates in real time until they arrive.

These two features are specified together because they share the same schema additions, the same geolocation infrastructure, and the same map rendering layer. Implementing one without the other is not permitted — the schema and service layers are designed to support both simultaneously.

No implementation code may be written for any component described here until this document has been reviewed and approved. Any conflict between this document and a standards document (`master-architecture.md`, `chow-here-design-system-v1.md`, `backend-standards.md`, etc.) is resolved in favour of the standards document.

---

## 1. BUSINESS OBJECTIVES

### 1.1 Primary Objectives

| ID | Objective | Rationale |
|---|---|---|
| BO-1 | Surface "X km away" on every restaurant card when user location is known | Distance is the primary decision signal after dish match — users need it to commit to going somewhere |
| BO-2 | Auto-detect user's city from GPS so the city selector is pre-filled on first visit | Reduces the friction of the city selection step, especially for new users and mobile visitors |
| BO-3 | Rank search results by proximity when coordinates are available | A 0.750-score restaurant 500m away beats a 1.000-score restaurant 20km away for a user who is hungry now |
| BO-4 | Show a map with the restaurant pin when a user opens a restaurant profile | Replaces the text-only address with a spatial understanding of where the place is |
| BO-5 | Track user position in real time during transit to the restaurant | Closes the gap between "I'm going there" and "I've arrived" — which is the most critical moment of the product journey |
| BO-6 | Detect arrival automatically and trigger the quality confirmation loop | Arrival confirmation is the primary input signal for quality verification in Phase 3 |

### 1.2 Explicit Non-Objectives

The following must not appear in Track 7:

- Turn-by-turn navigation (routing instructions) — Phase 3
- In-product routing engine — Google Maps / Apple Maps is the routing layer; this track hands off
- Traffic-aware ETAs
- Delivery or dispatch tracking
- Real-time restaurant availability updates triggered by arrival
- Social sharing of location or check-ins
- Ride-sharing or transport booking integrations
- Background location tracking when the app is closed (this is a browser app, not a native app — `watchPosition` stops when the tab is backgrounded)

---

## 2. FEATURE A: USER LOCATION & CLOSEST RESTAURANT DISCOVERY

### 2.1 The Location Flow

```
User opens the app
  ↓
App checks for existing location cookie (chow-city + chow-coords)
  ↓
[A] If coords present and < 24 hours old: use them silently
  ↓
[B] If no coords / cookie expired: show Location Prompt (see §2.3)
     → User grants GPS → browser geolocation API → city auto-detected
     → User denies GPS → manual city selector (existing Phase 1 flow)
  ↓
City context shown: "Near you in Lagos" (was: "Showing results in Lagos")
  ↓
Search results include distanceKm on every restaurant card
  ↓
Results ranked by proximity-weighted formula (see §5.2)
```

### 2.2 City Auto-Detection from GPS

When the user grants GPS permission, the returned `GeolocationCoordinates` (lat/lng) must be reverse-geocoded to a city name. This reverse-geocoding must happen client-side to avoid passing user coordinates to the Chow Here server — coordinates are sensitive and must never be logged or persisted server-side.

**Reverse geocoding approach:** The Google Maps Geocoding API (or Nominatim as a fallback) is called client-side from the browser using the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. The API response is parsed for the `locality` and `administrative_area_level_1` components, which map to a city and state name. The result is matched against the `NigerianCities` enum from `features/restaurants/schemas/nigeria.ts`.

If the reverse-geocoded city does not match any value in the `NigerianCities` enum (user is outside Nigeria or in a city not yet in the enum), the city is set to `null` (nationwide search) and the coordinates are still used for proximity ranking.

### 2.3 Location Prompt Design

The location prompt is not a modal. It is an inline banner shown below the search bar on the home page and below the city selector on the search page. It uses the standard toast / callout treatment from design system §10.8.

**Prompt copy:**

```
Headline: "Find the closest restaurant to you"
Body:     "Enable location to see how far each restaurant is."
CTA:      "Enable location" (primary button, amber-500)
Dismiss:  "Not now" (ghost, neutral-500, text-sm)
```

**Behaviour on dismiss:** The prompt is dismissed permanently in `localStorage` (`chow-location-prompt-dismissed`). It never reappears after the user has dismissed it once.

**Behaviour on grant:** The prompt collapses with `opacity 0, 200ms ease-in`. The city context label updates to "Near you in [City]". The search results re-rank with proximity.

**Behaviour on deny (browser denies):** The prompt is replaced with a short message: "Location access was denied. You can change this in your browser settings." with a "Dismiss" ghost button. The city selector falls back to manual selection.

### 2.4 Coordinate Storage (Client-Side Only)

User GPS coordinates are **never sent to the Chow Here server**. They are stored in `sessionStorage` only for the duration of the browser session. They are never written to a cookie or `localStorage`.

```typescript
// Stored in sessionStorage only — never server-side
interface ChowCoords {
  latitude: number
  longitude: number
  accuracy: number        // meters
  capturedAt: number      // Date.now()
  city: string | null     // reverse-geocoded city name or null
}
```

The `capturedAt` timestamp is checked on every use: if coordinates are more than 30 minutes old, a fresh `getCurrentPosition()` is triggered silently in the background. The UI does not block on this refresh.

### 2.5 Distance Display on Restaurant Cards

When user coordinates are available, every `SearchRestaurantCard` and `RestaurantCard` shows a distance badge below the location line.

**Format:** Rounded to 1 decimal place. Examples: "0.4 km", "2.1 km", "14 km" (no decimals above 10 km).

**Visual treatment:**
- Lucide `Navigation` icon, 12px, `neutral-400`
- `text-sm`, `neutral-500`
- Positioned: below the `MapPin` location line, same left-indent
- No distance badge when user coordinates are not available — the slot is invisible (no empty space)

### 2.6 Proximity-Weighted Search Ranking

Track 4 defined the base ranking formula with `distanceKm: null` as a placeholder. Track 7 fills that placeholder.

**Updated ranking formula (when coordinates are available):**

```
display_score = (
  fts_relevance    * 0.35   // primary: how well does this match the query?
  confidence_score * 0.25   // secondary: how verified is this restaurant?
  proximity_score  * 0.25   // tertiary: how close is the user? (NEW)
  availability     * 0.10   // quaternary: is the dish actually available?
  recency          * 0.05   // quinary: is the listing recent?
)
```

**When coordinates are NOT available** (user denied GPS, or coordinates expired), the formula falls back to the Track 4 formula:

```
display_score = (
  fts_relevance    * 0.40
  confidence_score * 0.35
  availability     * 0.15
  recency          * 0.10
)
```

**The proximity score calculation (applied in the search service):**

```typescript
// Haversine distance (km) between user and restaurant
// Applied in dish-restaurant.service.ts when userCoords is present
function proximityScore(distanceKm: number): number {
  if (distanceKm < 1)   return 1.00   // < 1 km: full score
  if (distanceKm < 3)   return 0.85   // 1–3 km: high score
  if (distanceKm < 7)   return 0.65   // 3–7 km: medium score
  if (distanceKm < 15)  return 0.40   // 7–15 km: low score
  if (distanceKm < 30)  return 0.20   // 15–30 km: very low score
  return 0.00                          // > 30 km: no proximity bonus
}
```

### 2.7 "Near Me" Sort Option

The search results page (`/search`) gains a sort control when user coordinates are available:

- **"Best match"** (default) — the proximity-weighted formula above
- **"Nearest first"** — sorted purely by `distanceKm ASC`, regardless of FTS or confidence

The sort option is surfaced as a `<select>` or segmented control in the search results header, visible only when `userCoords` is set. It is hidden when no coordinates are available.

URL encoding: `?sort=nearest` in the query string. The URL is the source of truth — same as all other search state in Track 4.

---

## 3. FEATURE B: RESTAURANT MAP + REAL-TIME JOURNEY TRACKING

### 3.1 The Map Flow

```
User opens restaurant profile page (/restaurants/[slug])
  ↓
Map panel is visible in the Location Section (replaces text-only address in Phase 1)
  ↓
Map shows: restaurant pin (amber-500) at restaurant coordinates
           user pin (green-500) at current GPS position (if permission granted)
           straight-line preview between the two points (not routed — just a visual line)
  ↓
User taps "Get Directions" button
  ↓
[Phase 3 — Turn-by-turn in-product]  OR  [Phase 2 — Native maps handoff]

During journey (user has tapped "Get Directions"):
  ↓
If user remains on the profile page (they didn't navigate away):
  → watchPosition() starts
  → User pin updates in real time as they move
  → Distance badge updates live: "1.2 km away" → "0.8 km away" → "0.3 km away"
  ↓
When distanceKm < 0.15 (approximately 150m):
  → Arrival detection triggers (see §3.6)
```

### 3.2 Map Library Choice

**Chosen library:** `maplibre-gl` (open-source, no API key required for rendering) with **Stadia Maps** tile provider (free tier: 300,000 tile requests/month).

**Why not Google Maps embed:**
- Google Maps embed requires a paid API key for all production use
- The embed iframe is a performance dependency that increases LCP
- MapLibre GL is a self-hosted, open-source WebGL renderer with no per-request billing
- Stadia Maps provides high-quality map tiles compatible with MapLibre GL
- The custom amber/neutral Chow Here map style (design system §14.2) is only achievable with a self-hosted renderer

**Why not Leaflet:**
- Leaflet is a 2D canvas renderer — no smooth zoom, no custom vector tile styles
- MapLibre GL supports the Mapbox GL style specification which enables the Chow Here custom map aesthetic

**Bundle size management:**
- `maplibre-gl` is loaded dynamically (`import()`) on the restaurant profile page only — not in the root bundle
- The map component is wrapped in `next/dynamic` with `{ ssr: false }` — map rendering requires browser APIs

### 3.3 Map Style (Design System §14.2)

The Chow Here map style is a custom Stadia Maps theme override. The map aesthetic must match the platform's colour palette:

| Element | Colour | Token |
|---|---|---|
| Land background | `#FAF9F7` | `neutral-50` equivalent |
| Roads — major | `#E8C547` | `amber-400` |
| Roads — minor | `#F5F0E8` | warm off-white |
| Water | `#C8DDF0` | cool blue-grey |
| Green space | `#D4E8D0` | muted green |
| Labels | `#1A1714` | `neutral-900` |
| Restaurant pin | `#F59E0B` | `amber-500` |
| User pin | `#22C55E` | `green-500` |
| Route line | `#F59E0B` | `amber-500`, 3px, dashed in Phase 2 |

The custom style JSON is defined in `src/lib/map-style.ts` and passed to the MapLibre GL map on initialisation.

### 3.4 Map Panel — Restaurant Profile Page

The map panel replaces the text-in-location section on the restaurant profile page. The text location fields (`area`, `address`, `city`, `state`) remain visible below the map.

**Layout (restaurant profile §13.2 Section 3 replacement):**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    MAP PANEL                            │
│                                                         │
│   [Restaurant pin, amber]                               │
│   [User pin, green — only if GPS granted]               │
│   [Straight-line preview between pins, if both present] │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  📍 Lekki Phase 1                                       │
│     14 Admiralty Way, Lekki                             │
│     Lagos, Lagos State          [Get Directions →]      │
└─────────────────────────────────────────────────────────┘
```

**Map panel dimensions:**
- Mobile: 100% viewport width × 220px height (no horizontal margin — edge-to-edge)
- Tablet (`md`+): 100% content column width × 300px height, `radius-xl` corners
- Desktop (`lg`+): full-width within the location section column × 360px height, `radius-xl` corners

**Map controls visible to consumer:**
- Zoom in / Zoom out buttons (MapLibre GL default, styled to match DS §10.1 icon button)
- No compass, no fullscreen toggle, no street view — only zoom

**Interactivity:**
- Pan and zoom: allowed
- Restaurant pin: tapping/clicking shows a small tooltip with the restaurant name and distance
- User pin: not tappable — it is a live position indicator only

**When restaurant has no coordinates (not yet geocoded):**
The map panel is replaced by the Phase 1 text-only location display (same as Track 3 §10.1). The "Get Directions" button links to the Google Maps text query (same as Track 3 §10.3). The map component never renders with a null restaurant pin — it must have a valid coordinate or not render at all.

### 3.5 Real-Time Position Updates

Real-time tracking is active only while the user is on the restaurant profile page and has granted GPS permission. It stops when the user navigates away.

**Implementation:**

```typescript
// In useRestaurantTracking.ts
useEffect(() => {
  if (!restaurantCoords || !userHasGrantedGPS) return

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords
      // Update user pin position on map
      // Update distanceKm badge
      // Check for arrival (§3.6)
      dispatch({ type: 'POSITION_UPDATE', payload: { latitude, longitude, accuracy } })
    },
    (error) => {
      // GPS error: stop watching, show static position or no pin
      dispatch({ type: 'GPS_ERROR', payload: error.code })
    },
    {
      enableHighAccuracy: true,   // request best available accuracy
      maximumAge: 15000,          // accept cached position up to 15s old
      timeout: 10000              // give up after 10s if no fix
    }
  )

  return () => navigator.geolocation.clearWatch(watchId)
}, [restaurantCoords, userHasGrantedGPS])
```

**Update frequency:** The browser controls `watchPosition` frequency. On most mobile devices with `enableHighAccuracy: true`, updates arrive every 1–3 seconds when moving. The map pin and distance badge update on every position event.

**Map animation on position update:** The user pin moves smoothly with `MapLibre GL` marker position interpolation. The animation duration is `500ms ease-out`. This is imperceptible as jitter at walking speed but visually smooth.

**Battery and performance note:** `enableHighAccuracy: true` consumes battery. The `watchPosition` call is made only when the user is on the restaurant profile page — not site-wide. It is explicitly cleared (`clearWatch`) when the component unmounts.

### 3.6 Arrival Detection

Arrival detection is a client-side check run on every `watchPosition` update.

**Arrival threshold:** `distanceKm < 0.15` (approximately 150 metres).

**Arrival confirmation flow (Phase 2 — defined here, not yet implemented):**

```
Distance < 150m is detected
  ↓
Arrival confirmation banner slides up from bottom of screen
  ↓
Banner copy: "You've arrived at [Restaurant Name]!"
  ↓
Prompt: "Did you eat here?" [Yes, I'm here] [Not yet]
  ↓
[Yes, I'm here] → POST /api/v1/users/arrivals { restaurantId, restaurantDishId }
                → This creates an ArrivalRecord (Phase 3 schema)
                → Triggers the quality signal loop (Track 8)
  ↓
[Not yet] → Dismiss banner; watchPosition continues
```

**Track 7 delivers:** The arrival detection check and the arrival banner UI.  
**Track 8 delivers:** The `ArrivalRecord` schema, the POST endpoint, and the quality signal loop.  

For Track 7, the [Yes, I'm here] button calls a stub handler that logs the event to the console and shows a "Thanks for confirming!" toast (green, `CheckCircle`, 3s). The stub is replaced in Track 8.

### 3.7 "Get Directions" Button

The "Get Directions" button on the restaurant profile page follows the Phase 2 interaction, replacing the Phase 1 plain address link.

**Phase 2 flow:**

```
User taps "Get Directions"
  ↓
If user has GPS permission AND restaurant has coordinates:
  → Opens native maps app with coordinate deep link
     (more precise than Phase 1's text query)
     iOS:    https://maps.apple.com/?daddr={lat},{lng}&dirflg=w
     Android: https://maps.google.com/maps?daddr={lat},{lng}&mode=walking
  → watchPosition() activates on the profile page (§3.5)
If user does NOT have GPS permission OR restaurant has no coordinates:
  → Falls back to Track 3 §10.3 text query link
```

**Button treatment (design system §10.1):**
- Primary button, `amber-500` fill, `neutral-0` text
- Label: "Get Directions"
- Icon: Lucide `Navigation`, 16px, left of text
- Touch target: 44×44px minimum height
- Positioned in the location section, below the address text, right-aligned

**This button replaces the Phase 1 tappable address link.** The address text remains visible as copyable text but is no longer the primary navigation affordance.

---

## 4. GEOCODING PIPELINE

### 4.1 What Geocoding Does

Geocoding converts a restaurant's text address (`Restaurant.address`, `city`, `state`) into GPS coordinates (`latitude`, `longitude`) and stores them on the `Restaurant` record.

This is an **admin-triggered** operation — not automatic. Coordinates are set by an admin during the intelligence enrichment phase, not automatically on restaurant approval. This preserves the trust guarantee: coordinates are verified by a human before being used in proximity ranking and map display.

### 4.2 Geocoding Service

**File:** `features/restaurants/services/geocoding.service.ts`

```typescript
interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string   // What the API returned — for admin review
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'   // Based on bounds area
  geocodedAt: Date
}

class GeocodingService {
  // Called by admin intelligence API when admin triggers geocoding
  async geocodeRestaurant(restaurantId: string): Promise<GeocodingResult>

  // Used for bulk geocoding of existing approved restaurants at Track 7 launch
  async geocodeBatch(restaurantIds: string[]): Promise<Map<string, GeocodingResult>>
}
```

**External dependency:** Google Maps Geocoding API (`@googlemaps/google-maps-services-js`). The API key is stored in `GOOGLE_MAPS_SERVER_API_KEY` (server-side only — never exposed to the client).

**Geocoding query construction:**
```
query = `${restaurant.address}, ${restaurant.area ?? ''}, ${restaurant.city}, ${restaurant.state}, Nigeria`
```

**Confidence classification from the Geocoding API response:**
- `HIGH`: `geometry.location_type = 'ROOFTOP'` or `'RANGE_INTERPOLATED'` — precise address match
- `MEDIUM`: `geometry.location_type = 'GEOMETRIC_CENTER'` — street or district centroid
- `LOW`: `geometry.location_type = 'APPROXIMATE'` — city or region level only

`LOW` confidence coordinates must not be used for map display or proximity ranking. The admin is shown the confidence level in the intelligence screen and can manually override coordinates or re-trigger geocoding.

### 4.3 Admin Geocoding Trigger

The admin intelligence screen (`/admin/restaurants/[id]/intelligence`) gains a new "Geocode address" action button in the Location section. This button calls:

```
POST /api/v1/admin/restaurants/[restaurantId]/geocode
Auth: ADMIN, SUPER
Body: {} (no body — uses restaurant's existing address fields)
Response 200: { latitude, longitude, formattedAddress, confidence, geocodedAt }
Response 422: { error: 'GEOCODING_FAILED', message: '...' }
Response 429: rate limited (max 20 geocoding requests per admin per hour)
```

The returned coordinates are not automatically saved — the admin sees a preview ("Geocoded to: 6.4281° N, 3.4219° E — Confidence: HIGH") and taps a "Save coordinates" confirm button before they are written to the database.

### 4.4 Manual Coordinate Override

Admins can also manually enter coordinates for restaurants where geocoding returns incorrect results (common in areas with poor address data, which is typical for Nigerian streets).

The intelligence screen provides two numeric inputs: `latitude` and `longitude`, pre-filled with the geocoded values if available. The admin can edit these directly and save.

Input validation:
- Latitude: must be within Nigeria's bounding box: `4.0 ≤ lat ≤ 13.9`
- Longitude: must be within Nigeria's bounding box: `2.7 ≤ lng ≤ 14.7`
- Values outside these bounds are rejected with: "Coordinates appear to be outside Nigeria. Verify before saving."

---

## 5. DISTANCE CALCULATION

### 5.1 Haversine Formula

All distance calculations use the Haversine formula. This is computed in application code (not in the database), applied during search ranking when user coordinates are passed to the search service.

**No PostGIS extension is required.** The scale of Phase 2 search volume does not justify PostGIS's operational complexity. Haversine in TypeScript is accurate to within ~0.5% for the distances relevant to restaurant discovery (< 50 km).

```typescript
// src/lib/geo.ts
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371  // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
```

### 5.2 Distance in Search Results

When `userLat` and `userLng` are passed as query parameters to `GET /api/v1/search`, the search service:

1. Fetches all candidate restaurants (same FTS + city filter as Track 4)
2. Computes `haversineKm(userLat, userLng, restaurant.latitude, restaurant.longitude)` for each candidate with non-null coordinates
3. Applies the updated ranking formula (§2.6) with `proximityScore(distanceKm)`
4. Returns `distanceKm` (rounded to 1 decimal) in the response for each restaurant

Restaurants with `latitude IS NULL` or `longitude IS NULL` receive `distanceKm: null` and a `proximityScore` of `0.00` — they still appear in results but rank below geocoded restaurants when proximity weighting is active.

### 5.3 User Coordinates in API Requests

User coordinates are sent to the search API as query parameters:

```
GET /api/v1/search?q=jollof+rice&userLat=6.4281&userLng=3.4219&city=Lagos
```

**Security note:** These coordinates are used only for distance calculation in the request handler. They are never logged, never persisted to the database, and never included in `SearchLog` or `UserSearchHistory` records. The `search-log.service.ts` must explicitly strip `userLat` and `userLng` before writing any log record.

---

## 6. SCHEMA CHANGES REQUIRED

### 6.1 Restaurant Model Additions

```prisma
model Restaurant {
  // ... all existing fields remain unchanged ...

  // Track 7 additions — Phase 2 location intelligence
  latitude      Float?     // WGS84 decimal degrees — null until geocoded
  longitude     Float?     // WGS84 decimal degrees — null until geocoded
  geocodedAt    DateTime?  // When coordinates were last set (admin action or override)
  geocodeConf   String?    @db.VarChar(10)  // 'HIGH' | 'MEDIUM' | 'LOW' — admin reference only

  // ... existing relations unchanged ...
}
```

**Index added:**

```sql
-- Partial index: only geocoded restaurants (reduces index size)
CREATE INDEX idx_restaurant_geocoded
ON "Restaurant" (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

### 6.2 No Other Schema Changes Required

| Field | Model | Status |
|---|---|---|
| `latitude`, `longitude`, `geocodedAt`, `geocodeConf` | `Restaurant` | NEW — this migration |
| All other Restaurant fields | `Restaurant` | Unchanged |
| `SavedDish`, `UserSearchHistory`, `SearchLog` | All | Unchanged — coordinates are never persisted for users |

### 6.3 Migration File

**File:** `prisma/migrations/[timestamp]_add_restaurant_coordinates/migration.sql`

```sql
ALTER TABLE "Restaurant"
  ADD COLUMN "latitude"     DOUBLE PRECISION,
  ADD COLUMN "longitude"    DOUBLE PRECISION,
  ADD COLUMN "geocodedAt"   TIMESTAMP(3),
  ADD COLUMN "geocodeConf"  VARCHAR(10);

CREATE INDEX "idx_restaurant_geocoded"
  ON "Restaurant" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
```

Per AD-9: this migration must be documented in `database-track.md` before it is applied.

---

## 7. API CHANGES

### 7.1 Updated: GET /api/v1/search

**New optional query params:**

| Param | Type | Description |
|---|---|---|
| `userLat` | Float | User's latitude (WGS84) |
| `userLng` | Float | User's longitude (WGS84) |
| `sort` | `"relevance"` \| `"nearest"` | Default: `"relevance"` |

**Updated response shape** (addition to `SearchRestaurantResult`):

```typescript
// Previously: distanceKm: null  (Phase 1 placeholder)
// Now: populated when restaurant is geocoded AND userLat/userLng are present
distanceKm: number | null   // null if restaurant not geocoded or no user coords
```

**Validation:**
- `userLat` and `userLng` must both be present or both absent — providing only one is a 400 error
- Both values must be valid floating-point numbers
- If out of Nigeria's bounding box, they are accepted but will produce large distances (no special handling)

### 7.2 Updated: GET /api/v1/restaurants/:slug

**Updated response shape** (addition to `RestaurantProfileResponse`):

```typescript
// Track 7 addition — included only when geocodeConf is 'HIGH' or 'MEDIUM'
// Never included when geocodeConf is 'LOW' or null
coordinates: {
  latitude: number
  longitude: number
} | null
```

`geocodedAt` and `geocodeConf` are never returned to the consumer. Only the coordinates themselves are exposed, and only at HIGH/MEDIUM confidence.

### 7.3 New: POST /api/v1/admin/restaurants/:restaurantId/geocode

Defined in §4.3. Triggers server-side geocoding. Returns a preview for admin confirmation.

### 7.4 Updated: PATCH /api/v1/admin/restaurants/:restaurantId/intelligence

**New optional fields** added to `IntelligenceUpdateSchema`:

```typescript
// coordinates override — admin manual entry
latitude?: number    // 4.0 ≤ lat ≤ 13.9
longitude?: number   // 2.7 ≤ lng ≤ 14.7
```

When either `latitude` or `longitude` is present in the payload, both must be present. Partial coordinate updates are rejected with a 400 error.

---

## 8. NEW COMPONENTS

### 8.1 Component Inventory

| Component | File | Purpose |
|---|---|---|
| `RestaurantMap` | `features/restaurants/components/RestaurantMap.tsx` | Map panel for restaurant profile page — restaurant pin + user pin |
| `LocationPrompt` | `features/location/components/LocationPrompt.tsx` | Inline GPS permission request banner |
| `DistanceBadge` | `features/location/components/DistanceBadge.tsx` | "X km away" label for cards |
| `useUserLocation` | `features/location/hooks/useUserLocation.ts` | Hook: manages GPS permission, coords, city auto-detection |
| `useRestaurantTracking` | `features/location/hooks/useRestaurantTracking.ts` | Hook: watchPosition for restaurant profile real-time tracking |
| `ArrivalBanner` | `features/location/components/ArrivalBanner.tsx` | Arrival detection UI — "You've arrived!" confirmation banner |
| `location.store.ts` | `features/location/stores/location.store.ts` | Zustand: userCoords, GPS permission state, city override |
| `geo.ts` | `src/lib/geo.ts` | Haversine formula utility |
| `map-style.ts` | `src/lib/map-style.ts` | MapLibre GL custom style JSON |

### 8.2 RestaurantMap Component

```typescript
interface RestaurantMapProps {
  restaurantName: string
  restaurantCoords: { latitude: number; longitude: number } | null
  userCoords?: { latitude: number; longitude: number } | null
  onDirectionsClick: () => void
  className?: string
}
```

**Behaviour when `restaurantCoords` is null:** Component returns `null` — no map renders. The caller (restaurant profile page) falls back to the Phase 1 text-only location display.

**Behaviour when `userCoords` is null:** Map renders with only the restaurant pin. No user pin. No route line. The map is still useful — it shows where the restaurant is.

**Behaviour when both are present:** Map renders both pins with a dashed straight-line connector. The map viewport auto-fits to show both pins with 15% padding.

**Loading state:** A skeleton (same dimensions as the map panel) with a `neutral-100` background and a subtle `MapPin` icon centered at 32px, `neutral-300`. Matches design system §16 skeleton patterns.

### 8.3 useUserLocation Hook

```typescript
interface UserLocationState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
  coords: { latitude: number; longitude: number; accuracy: number } | null
  city: string | null          // reverse-geocoded city name
  distanceTo: (lat: number, lng: number) => number | null  // returns km or null
  requestPermission: () => void
  dismiss: () => void          // dismisses the location prompt permanently
}
```

**State machine:**

```
idle
  → [user taps "Enable location"] → requesting
  → [location prompt dismissed] → idle (prompt hidden permanently)

requesting
  → [browser grants permission] → granted (coords set, city auto-detected)
  → [browser denies permission] → denied
  → [timeout / unavailable]     → unavailable

granted
  → [coords > 30min old] → background refresh (silent, stays in 'granted')

denied / unavailable
  → [user navigates to browser settings and grants, then returns] → idle (re-check on focus)
```

### 8.4 Location Feature Module Structure

```
features/location/
├── components/
│   ├── LocationPrompt.tsx        ← inline GPS banner
│   ├── DistanceBadge.tsx         ← "X km away" display
│   └── ArrivalBanner.tsx         ← arrival confirmation
├── hooks/
│   ├── useUserLocation.ts        ← GPS permission + coords management
│   └── useRestaurantTracking.ts  ← watchPosition for real-time tracking
├── stores/
│   └── location.store.ts         ← Zustand: userCoords, permission status
├── services/
│   └── geocoding.service.ts      ← server-side geocoding (admin use only)
└── index.ts                      ← barrel file (export only what consumers need)
```

---

## 9. SECURITY AND PRIVACY

### 9.1 User Coordinates Are Never Server-Side

This is the most important privacy constraint in Track 7.

- User GPS coordinates (`userLat`, `userLng`) may be passed as query parameters to the search API for distance computation only
- They must be stripped from all logs: Vercel function logs, `SearchLog`, `UserSearchHistory`, and any other persistence layer
- No audit event, analytics event, or database record may contain user coordinates
- The `search-log.service.ts` must redact `userLat` and `userLng` from the log payload before writing

**Implementation pattern:**

```typescript
// In search-log.service.ts — strip coordinates before logging
function prepareLogPayload(params: SearchParams): SearchLogPayload {
  const { userLat, userLng, ...safeParams } = params
  return safeParams  // userLat and userLng are explicitly excluded
}
```

### 9.2 Restaurant Coordinates Are Safe to Expose

`Restaurant.latitude` and `Restaurant.longitude` are the coordinates of a business, not a person. They are safe to include in public API responses (§7.2) and rendered on public map panels. No privacy concern.

### 9.3 Google Maps API Key Segregation

Two separate Google Maps API keys are used:

| Key | Name | Environment Variable | Restrictions |
|---|---|---|---|
| Server-side geocoding key | For geocoding API only | `GOOGLE_MAPS_SERVER_API_KEY` | Restricted to Geocoding API; IP-restricted to Vercel server IPs |
| Client-side maps key | For map tile rendering if needed | `NEXT_PUBLIC_GOOGLE_MAPS_CLIENT_KEY` | HTTP referrer restricted to the production domain |

If using MapLibre GL + Stadia Maps (§3.2), the client-side Google Maps key is not needed for map rendering — only for reverse geocoding in the `useUserLocation` hook. Stadia Maps has its own API key stored in `NEXT_PUBLIC_STADIA_MAPS_API_KEY`.

---

## 10. LOADING STATES

Per design system §16:

| Context | Skeleton |
|---|---|
| Map panel (restaurant profile) | Full-width rect, same height as map, `neutral-100` bg, centered `MapPin` icon at 32px `neutral-300` |
| Distance badge (restaurant card) | Single line, 50px wide, `neutral-100` bg — appears only if user has GPS permission |
| Location prompt | Full-width banner, 64px height, `neutral-50` bg — 200ms delay (per §16.1) |
| Arrival banner | Slides in from bottom — no skeleton (it appears fully formed on arrival detection) |

---

## 11. EMPTY STATES AND ERROR STATES

### 11.1 No Restaurant Coordinates

When `restaurant.coordinates` is null on the profile page (restaurant not yet geocoded):
- Map panel is not shown
- Phase 1 text-only location display is used (Track 3 §10.1)
- "Get Directions" opens the Google Maps text query (Track 3 §10.3)
- No error message to the user — the absence of the map is not an error state

### 11.2 GPS Permission Denied

When the user denies GPS:
- Location prompt is replaced with: "Location access was denied. You can allow it in your browser settings." — `text-sm`, `neutral-500`
- All distance badges across the UI are hidden
- Search results use the Track 4 formula (no proximity weighting)
- City selector remains manual (existing Phase 1 flow)

### 11.3 GPS Timeout / Unavailable

When `getCurrentPosition()` times out (10s) or the device has no GPS:
- Same visual treatment as Denied (§11.2)
- `status` set to `'unavailable'` in `useUserLocation`

### 11.4 Geocoding API Failure (Admin)

When the server-side geocoding call fails:
- Admin sees an error toast: "Geocoding failed. The address may not be specific enough. Try adding the area (e.g., 'Lekki Phase 1') and retry."
- No partial write — coordinates are not updated on failure
- Admin can retry or enter coordinates manually

### 11.5 watchPosition Error During Tracking

When `watchPosition` returns an error after tracking has started:
- User pin disappears from the map (no error shown — the map continues to show the restaurant pin)
- Distance badge goes static (last known value with a `~` prefix: "~0.8 km")
- Arrival detection pauses

---

## 12. MOBILE-FIRST REQUIREMENTS

### 12.1 GPS on Mobile

The primary use case for this feature is a mobile user who is actively planning to travel to a restaurant. Desktop GPS support is secondary.

- On mobile, `navigator.geolocation` is widely supported and typically accurate to < 20m
- On desktop, accuracy may be 100–2000m (Wi-Fi triangulation only) — the distance badge is shown but with reduced reliability
- No special handling for low-accuracy desktop: show the distance as computed, no caveat label

### 12.2 Map on Mobile

- Map panel is full-width, edge-to-edge on mobile (no horizontal padding)
- MapLibre GL handles touch gestures natively: two-finger pan and pinch-to-zoom
- The "Get Directions" button is sticky at the bottom of the screen on mobile when the user has scrolled past the map panel (follows the Phase 1 bottom nav pattern but is positioned above the ConsumerBottomNav)
- Safe area insets: `padding-bottom: env(safe-area-inset-bottom)` on the sticky CTA

### 12.3 Arrival Banner on Mobile

The arrival banner slides up from the bottom of the screen (above the ConsumerBottomNav) using `translateY(100%) → translateY(0)`, `300ms ease-out`. It occupies the full viewport width and is 80px tall. It does not cover the ConsumerBottomNav — it sits above it.

---

## 13. FUTURE NAVIGATION COMPATIBILITY

### 13.1 What Track 7 Preserves for Track 8

- `Restaurant.latitude` and `Restaurant.longitude` are the permanent coordinate fields — they survive into Phase 3 routing
- The `distanceKm` field in search responses is the permanent distance field — Phase 3 adds turn-by-turn ETA but the field name and type remain
- The `ArrivalBanner` stub (§3.6) is designed to accept the Track 8 arrival confirmation API without UI changes
- The `useRestaurantTracking` hook's `watchPosition` infrastructure is designed so that Phase 3 can add route-following logic without replacing the hook — only the arrival detection threshold and behaviour changes

### 13.2 What Track 7 Must NOT Pretend to Deliver

- No routing instructions or turn-by-turn directions (Phase 3)
- No ETA based on traffic (Phase 3)
- No offline map caching
- No background tracking when the app tab is inactive

---

## 14. IMPLEMENTATION SEQUENCE

Track 7 follows the implementation law: Schema → Service → API → UI.

### Step 0 — Database Migration (Prerequisite)

**Before any other work begins:**
1. Update `database-track.md` to document the new Restaurant fields (AD-9 — mandatory before migration)
2. Add `latitude`, `longitude`, `geocodedAt`, `geocodeConf` to `prisma/schema.prisma`
3. Write migration: `prisma/migrations/[timestamp]_add_restaurant_coordinates/migration.sql`
4. Add partial index on geocoded restaurants
5. Run migration against development database
6. Verify: `\d "Restaurant"` in psql shows the four new columns
7. Confirm existing seeded restaurants have `latitude = null`, `longitude = null`

### Step 1 — Geo Utility

1. `src/lib/geo.ts` — `haversineKm()` function
2. Unit tests (minimum 10 cases):
   - Known coordinates with known distances (e.g., Lagos Island to Lekki: ~12 km)
   - Zero distance (same point)
   - Antipodal points
   - Negative latitude / longitude values
   - Result is within 1% of ground truth for all test cases

### Step 2 — Map Style

1. `src/lib/map-style.ts` — MapLibre GL style JSON (§3.3 colour tokens)
2. No tests — visual review in browser is the verification
3. Stadia Maps API key provisioned and stored in `NEXT_PUBLIC_STADIA_MAPS_API_KEY`

### Step 3 — Location Feature Module: Store and Hooks

1. `features/location/stores/location.store.ts` — Zustand store
2. `features/location/hooks/useUserLocation.ts` — GPS permission + coords management + city auto-detection
3. Unit tests for `useUserLocation` state machine (mock `navigator.geolocation`):
   - `idle → requesting → granted` path
   - `idle → requesting → denied` path
   - `idle → requesting → unavailable` (timeout) path
   - Coordinate refresh when coords > 30 min old
   - `distanceTo()` returns null when coords are null
   - `distanceTo()` returns correct km when coords are set

### Step 4 — Geocoding Service

1. `features/location/services/geocoding.service.ts`
2. `GOOGLE_MAPS_SERVER_API_KEY` env var provisioned
3. Unit tests (mock the Google Maps client):
   - Returns `GeocodingResult` with HIGH confidence for a precise address
   - Returns MEDIUM confidence for a street-level match
   - Returns LOW confidence for a city-level match
   - Throws on API error
   - Throws on empty results
4. Integration test: geocode a known Lagos restaurant address and verify coordinates are within 500m of ground truth

### Step 5 — Admin Geocoding API

1. `app/api/v1/admin/restaurants/[restaurantId]/geocode/route.ts`
2. Auth: ADMIN, SUPER (same pattern as all admin routes)
3. Rate limit: 20/admin/hour
4. Returns preview — does NOT auto-save coordinates
5. Tests: auth enforcement, rate limiting, geocoding success response, geocoding failure (mock returns empty results)

### Step 6 — Intelligence API Update (Coordinate Override)

1. Update `features/admin/schemas/intelligence.schema.ts` — add `latitude`, `longitude` optional fields with Nigeria bounding box validation
2. Update `features/verification/services/intelligence.service.ts` — handle coordinate fields in `recalculateRestaurantIntelligence()`
3. Update `app/api/v1/admin/restaurants/[restaurantId]/intelligence/route.ts` — pass through new fields
4. Tests: coordinate validation (in-bounds, out-of-bounds, partial — one field without the other)

### Step 7 — Search API Update (userLat / userLng)

1. Update `features/search/schemas/search.schema.ts` — add `userLat`, `userLng`, `sort` to query schema
2. Update `features/search/services/dish-restaurant.service.ts` — apply `haversineKm()` and proximity ranking when coords present
3. Update `features/search/services/search-log.service.ts` — strip `userLat`/`userLng` from log payload
4. Update `app/api/v1/search/route.ts` — pass `userLat`/`userLng` to search service; populate `distanceKm` in response
5. Tests:
   - `distanceKm` populated when restaurant has coordinates and user coords are present
   - `distanceKm` is null when restaurant has no coordinates
   - `distanceKm` is null when no user coords passed
   - User coords are NOT present in the SearchLog record written
   - Proximity-weighted ranking changes result order compared to base formula
   - `sort=nearest` overrides formula and sorts purely by distance
   - Partial coords (only lat, no lng) → 400 response

### Step 8 — Restaurant Profile API Update

1. Update `features/restaurants/services/restaurant-listing.service.ts` — include `coordinates` in profile response when `geocodeConf` is HIGH or MEDIUM
2. Update `app/api/v1/restaurants/[slug]/route.ts` — include `coordinates` field
3. Tests:
   - `coordinates` present in response when `geocodeConf = 'HIGH'`
   - `coordinates` present in response when `geocodeConf = 'MEDIUM'`
   - `coordinates` absent (null) when `geocodeConf = 'LOW'`
   - `coordinates` absent (null) when `geocodedAt` is null
   - `geocodeConf` raw value never appears in response

### Step 9 — Location UI Components

1. `features/location/components/LocationPrompt.tsx` — GPS permission banner
2. `features/location/components/DistanceBadge.tsx` — "X km away" label
3. `features/location/index.ts` — barrel file
4. Visual review in browser at 375px (mobile), 768px (tablet), 1280px (desktop)
5. Accessibility: location prompt has `role="banner"`, "Enable location" button has `aria-label="Enable GPS location"`

### Step 10 — RestaurantMap Component

1. `features/restaurants/components/RestaurantMap.tsx` — MapLibre GL map panel
2. `next/dynamic` with `{ ssr: false }` — no server-side rendering
3. Restaurant pin: custom amber `MapPin` marker
4. User pin: custom green `Navigation` marker
5. Route line: dashed amber line when both pins present
6. Viewport auto-fit to show both pins with 15% padding
7. Loading skeleton: correct dimensions
8. `null` guard: component returns null when `restaurantCoords` is null
9. Visual review in browser (map renders correctly at all breakpoints)

### Step 11 — Real-Time Tracking Hook

1. `features/location/hooks/useRestaurantTracking.ts` — `watchPosition` lifecycle management
2. Tests (mock `navigator.geolocation.watchPosition`):
   - Position updates propagate to state
   - Arrival threshold (`< 0.15 km`) triggers `onArrival` callback
   - `clearWatch` is called on component unmount
   - GPS error sets status to error state, does not throw

### Step 12 — Arrival Banner

1. `features/location/components/ArrivalBanner.tsx` — arrival confirmation UI
2. Slides up from bottom on arrival detection
3. "Yes, I'm here" calls stub handler (console.log + success toast) — replaced in Track 8
4. "Not yet" dismisses banner and continues tracking
5. Animation: `translateY(100%) → translateY(0)`, `300ms ease-out` (matches DS §7.4 modal enter)
6. Safe area insets on bottom padding

### Step 13 — Restaurant Profile Page Integration

1. Update `app/(public)/restaurants/[slug]/page.tsx`:
   - Pass `coordinates` from API response to `RestaurantMap`
   - Replace Phase 1 text-only location section with map panel + text fields below
   - Add "Get Directions" button with coordinate deep link when coords available
   - Add `useRestaurantTracking` for real-time tracking
   - Add `ArrivalBanner` above ConsumerBottomNav
2. Visual review: map panel renders at all breakpoints; text location fields remain visible below map

### Step 14 — Search Page Integration

1. Update `app/(public)/search/SearchPageClient.tsx`:
   - Add `LocationPrompt` component (shown if `status = 'idle'` and not permanently dismissed)
   - Pass `userLat`/`userLng` from `location.store` to search query params
   - Render `DistanceBadge` on `SearchRestaurantCard` when `distanceKm` is present
   - Add sort control (relevance / nearest) when user coords are available
2. Update `app/(public)/page.tsx` (home page):
   - Update city context label: "Near you in [City]" when GPS granted, "Showing results in [City]" when manual

### Step 15 — Admin Intelligence Screen Update

1. Update `app/admin/restaurants/[id]/intelligence/page.tsx`:
   - Add Geocoding section: "Geocode address" button + preview display
   - Add manual coordinate inputs (lat/lng) with Nigeria bounding box validation
   - Show current `geocodeConf` label beside coordinates
2. Accessibility: coordinate inputs have `aria-label="Latitude"` and `aria-label="Longitude"`

---

## 15. SUCCESS METRICS

### 15.1 Functional Completeness

| Metric | Target | Verification |
|---|---|---|
| `distanceKm` populates on search results when user grants GPS and restaurant has coordinates | 100% | Integration test |
| User coordinates never appear in `SearchLog` or `UserSearchHistory` | 100% | Test: inspect log record after search with coords |
| Restaurant map renders correctly when `geocodeConf = 'HIGH'` or `'MEDIUM'` | 100% | Visual review |
| Map does NOT render when `geocodeConf = 'LOW'` or `null` | 100% | Integration test |
| `watchPosition` clears on profile page unmount (no memory leak) | 100% | Test: confirm `clearWatch` called |
| Arrival detection fires at `distanceKm < 0.15` | 100% | Unit test with mock positions |
| Admin geocode preview does not auto-save coordinates without confirmation | 100% | Manual test |

### 15.2 Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Map panel — time to first render (initial restaurant load) | < 1.5s on 4G | Manual + Lighthouse |
| GPS permission request — response to prompt | < 500ms after user tap | Manual observation |
| Position update to map pin update latency | < 200ms | Manual observation (walking test) |
| `haversineKm()` computation for 20 restaurants | < 1ms | Benchmark test |
| Map tile initial load (Stadia Maps) | < 1.0s on 4G | Lighthouse network panel |

### 15.3 Privacy Targets

| Metric | Target | Verification |
|---|---|---|
| No user coordinate in any database row after a proximity search | 100% | DB query after integration test |
| No user coordinate in Vercel function logs | 100% | Log inspection after test run |
| `GOOGLE_MAPS_SERVER_API_KEY` never exposed to browser | 100% | Check Next.js bundle output — key must not appear |

---

## 16. RISKS AND EDGE CASES

### 16.1 Address Quality for Geocoding

**Risk:** Many Nigerian restaurant addresses are informal (e.g., "By Chicken Republic, Allen Avenue") and will return LOW confidence or no results from the Geocoding API.

**Resolution:** The admin manual coordinate override (§4.4) is the fallback for all such cases. Admins are trained to use Google Maps to find the precise location of a restaurant and enter the coordinates manually. `LOW` confidence geocodes are never surfaced to consumers.

### 16.2 Restaurants Without Coordinates at Launch

**Risk:** At Track 7 launch, no existing approved restaurant has coordinates. All search results will show `distanceKm: null`.

**Resolution:** This is expected and acceptable. Distance badges are hidden when `distanceKm` is null — no broken UI. The admin team geocodes high-priority restaurants in the first week post-launch. As more restaurants are geocoded, proximity features become increasingly useful. There is no need to block Track 7 launch on bulk geocoding.

### 16.3 GPS Inaccuracy in Dense Urban Areas

**Risk:** In dense Lagos urban areas (e.g., Lagos Island CBD), GPS accuracy may be 50–100m due to multi-path reflection from tall buildings. This means the "0.1 km away" badge may show even when the user is still 200m from the restaurant.

**Resolution:** The arrival threshold (`< 0.15 km`) is set conservatively to absorb this inaccuracy. The `accuracy` field from the `GeolocationCoordinates` is logged (client-side only) but not displayed to the user. No accuracy caveat is shown — it would create confusion without being actionable.

### 16.4 MapLibre GL Bundle Size

**Risk:** `maplibre-gl` is a 300KB+ gzipped bundle. Loading it on every restaurant profile page would significantly increase the initial bundle.

**Resolution:** `next/dynamic` with `{ ssr: false }` (§8.2) ensures MapLibre GL is loaded only when the restaurant profile page renders in the browser. It is not in the critical path for the initial HTML load. The LCP is the hero image, which renders before MapLibre GL is even requested.

### 16.5 Stadia Maps Tile API Outage

**Risk:** If Stadia Maps is unavailable, the map panel renders blank (no tiles, only the restaurant and user pins on a grey background).

**Resolution:** The map panel has an error boundary that catches tile load failures. On failure, the map is replaced with the Phase 1 text-only location display (§11.1). The "Get Directions" button remains functional.

### 16.6 watchPosition Battery Drain

**Risk:** `enableHighAccuracy: true` in `watchPosition` activates the device GPS chip continuously, draining battery.

**Resolution:** `watchPosition` is active only on the restaurant profile page. It is explicitly cleared on page unload. Phase 3 (turn-by-turn navigation) will introduce a dedicated in-app navigation mode with explicit "start navigation" and "end navigation" controls that the user opts into.

---

## Document Relationships

```
master-architecture.md              ← Governing law (highest authority)
chow-here-design-system-v1.md      ← UI law (all component decisions)
    │
    ├── backend-standards.md        ← API implementation patterns
    ├── frontend-standards.md       ← React component patterns
    ├── security-standards.md       ← API key handling, no server-side user coords
    └── data-governance.md          ← User coordinate privacy constraints
    │
    ├── restaurant-listing-track.md ← Track 3 (location section replaced by map)
    └── track-04-search-discovery.md ← Track 4 (search ranking formula extended)
    │
    └── track-07-navigation-location.md ← THIS DOCUMENT
            │
            ├── Depends on: restaurant-listing-track.md (Track 3 complete)
            ├── Depends on: track-04-search-discovery.md (Track 4 complete)
            └── Feeds into: Track 8 — Arrival Confirmation & Quality Loop
```

---

*This document is authoritative for Track 7 implementation. No implementation code may be written until this document is reviewed and approved. Changes during implementation require explicit versioning and a note in the changelog below.*

**Changelog:**
- v1.0 — 2026-06-12 — Initial specification covering Feature A (GPS location + proximity search) and Feature B (restaurant map + real-time tracking)

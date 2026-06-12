// MapLibre GL style configuration for Chow Here.
// Uses Stadia Maps Alidade Smooth tile set — no per-request billing.
// Amber accent overlay matches design-system-v1.md brand palette.
//
// Requires NEXT_PUBLIC_STADIA_API_KEY environment variable.
// Track 7: track-07-navigation-location.md §9

export function getMapStyle(): string {
  const key = process.env.NEXT_PUBLIC_STADIA_API_KEY ?? ''
  const base = 'https://tiles.stadiamaps.com/styles/alidade_smooth.json'
  return key ? `${base}?api_key=${key}` : base
}

// Restaurant marker colour — amber-500 from design-system-v1.md
export const MARKER_COLOR = '#D4740A'

// User location marker — green-500
export const USER_MARKER_COLOR = '#1B5E3B'

// Default zoom level for restaurant map view
export const DEFAULT_ZOOM = 15

// Nigeria centre — fallback when no coordinates
export const NIGERIA_CENTER: [number, number] = [8.6753, 9.0820]

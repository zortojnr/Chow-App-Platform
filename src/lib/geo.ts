// Haversine distance calculation for Track 7 proximity features.
// All calculations are client-side or server-side TS only.
// User GPS coordinates are NEVER written to the database or logs.

const EARTH_RADIUS_KM = 6371

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

// Proximity score: linear decay from 1.0 at 0 km to 0.0 at 20 km.
// Clamps to [0, 1].
export function proximityScore(km: number): number {
  return Math.max(0, 1 - km / 20)
}

// Arrival threshold per track-07 §8.3: < 150 m
export const ARRIVAL_THRESHOLD_KM = 0.15

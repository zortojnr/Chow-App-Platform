// Admin Geocoding Service — Track 7
//
// Sets restaurant coordinates via Google Maps Geocoding API.
// Only admins can trigger geocoding (POST /api/v1/admin/restaurants/:id/geocode).
//
// Privacy contract (track-07 §6):
//   - User GPS coordinates are NEVER used here — this service handles restaurant
//     coordinates only, set by admins, derived from the restaurant's address.
//   - geocodeConf stores a confidence tier: 'ROOFTOP', 'RANGE', 'APPROX', 'FAILED'
//
// Governed by: track-07-navigation-location.md §4

import { db } from '@/lib/db'

const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

type GeocodeResult = {
  latitude: number
  longitude: number
  confidence: 'ROOFTOP' | 'RANGE' | 'APPROX' | 'FAILED'
}

type LocationType = 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE'

function toConfidence(locationType: LocationType): GeocodeResult['confidence'] {
  if (locationType === 'ROOFTOP') return 'ROOFTOP'
  if (locationType === 'RANGE_INTERPOLATED') return 'RANGE'
  if (locationType === 'GEOMETRIC_CENTER') return 'APPROX'
  return 'APPROX'
}

export const GeocodingService = {
  /**
   * Geocodes a restaurant's address via Google Maps and persists
   * latitude, longitude, geocodedAt, geocodeConf to the restaurant record.
   *
   * Returns the updated coordinates or throws on failure.
   */
  async geocodeRestaurant(restaurantId: string): Promise<{
    latitude: number
    longitude: number
    confidence: string
  }> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not configured')

    const restaurant = await db.restaurant.findFirst({
      where: { id: restaurantId },
      select: { id: true, address: true, city: true, state: true },
    })
    if (!restaurant) throw new Error('Restaurant not found')

    const address = `${restaurant.address}, ${restaurant.city}, ${restaurant.state}, Nigeria`
    const url = `${GOOGLE_GEOCODING_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Geocoding API error: ${res.status}`)

    const data = (await res.json()) as {
      status: string
      results: Array<{
        geometry: {
          location: { lat: number; lng: number }
          location_type: LocationType
        }
      }>
    }

    if (data.status !== 'OK' || !data.results[0]) {
      throw new Error(`Geocoding failed: ${data.status}`)
    }

    const { lat, lng } = data.results[0].geometry.location
    const confidence = toConfidence(data.results[0].geometry.location_type)

    await db.restaurant.update({
      where: { id: restaurantId },
      data: {
        latitude: lat,
        longitude: lng,
        geocodedAt: new Date(),
        geocodeConf: confidence,
      },
    })

    return { latitude: lat, longitude: lng, confidence }
  },

  /**
   * Clears coordinates from a restaurant (e.g. if address changes).
   */
  async clearCoordinates(restaurantId: string): Promise<void> {
    await db.restaurant.update({
      where: { id: restaurantId },
      data: {
        latitude: null,
        longitude: null,
        geocodedAt: null,
        geocodeConf: null,
      },
    })
  },
}

'use client'

// RestaurantMap — Track 7
//
// Static (non-interactive) MapLibre GL map showing a restaurant's pinned location.
// interactive: false is intentional — it prevents the map from capturing any
// scroll, touch, or wheel events, which would block page scrolling.
//
// A "Get Directions" link opens Google Maps for navigation.
// User position dot is still shown (read from location store, drawn as a marker).
//
// Governed by: track-07-navigation-location.md §9

import { useEffect, useRef } from 'react'
import { Navigation, MapPin } from 'lucide-react'
import { getMapStyle, MARKER_COLOR, USER_MARKER_COLOR, DEFAULT_ZOOM } from '@/lib/map-style'
import { useLocationStore } from 'features/location/stores/location.store'

interface RestaurantMapProps {
  latitude: number
  longitude: number
  restaurantName: string
  address?: string
  className?: string
}

export function RestaurantMap({
  latitude,
  longitude,
  restaurantName,
  address,
  className,
}: RestaurantMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<import('maplibre-gl').Map | null>(null)
  const userMarkerRef = useRef<import('maplibre-gl').Marker | null>(null)

  const { latitude: userLat, longitude: userLng, permission } = useLocationStore()

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: import('maplibre-gl').Map

    import('maplibre-gl').then((ml) => {
      // Inject MapLibre CSS once
      if (!document.getElementById('maplibre-css')) {
        const link = document.createElement('link')
        link.id   = 'maplibre-css'
        link.rel  = 'stylesheet'
        link.href = 'https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css'
        document.head.appendChild(link)
      }

      map = new ml.Map({
        container: containerRef.current!,
        style: getMapStyle(),
        center: [longitude, latitude],
        zoom: DEFAULT_ZOOM,
        interactive: false,
        attributionControl: { compact: true },
      })

      // MapLibre CSS injects touch-action:none on the canvas even when interactive:false.
      // Override it so the browser handles touch/scroll as normal page scrolling.
      map.on('load', () => {
        const canvas = map.getCanvas()
        canvas.style.touchAction = 'pan-y'
      })

      // Restaurant pin marker
      const el = document.createElement('div')
      el.style.cssText = `
        width: 32px; height: 32px;
        background: ${MARKER_COLOR};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      `
      new ml.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map)

      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude])

  // Draw / update user position dot when GPS state changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || permission !== 'granted' || userLat === null || userLng === null) return

    import('maplibre-gl').then((ml) => {
      userMarkerRef.current?.remove()

      const dot = document.createElement('div')
      dot.style.cssText = `
        width: 14px; height: 14px;
        background: ${USER_MARKER_COLOR};
        border-radius: 50%;
        border: 2px solid #fff;
        box-shadow: 0 0 0 4px rgba(27,94,59,0.2);
      `
      userMarkerRef.current = new ml.Marker({ element: dot })
        .setLngLat([userLng, userLat])
        .addTo(map)
    })
  }, [userLat, userLng, permission])

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Map canvas */}
      <div
        ref={containerRef}
        className={className ?? 'w-full h-56'}
        aria-label={`Map showing location of ${restaurantName}`}
        role="img"
      />
      {/* Get Directions — below the map */}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-3 bg-neutral-100 hover:bg-neutral-200 transition-colors duration-fast text-sm font-medium text-neutral-700 focus-visible:outline-none focus-visible:shadow-brand"
      >
        <Navigation size={15} className="shrink-0 text-amber-500" aria-hidden="true" />
        Get Directions
      </a>
    </div>
  )
}

// Shown when the restaurant has no coordinates yet
export function MapUnavailable({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-10 rounded-xl bg-neutral-100 text-neutral-400 ${className ?? ''}`}
      aria-label="Map not available"
    >
      <MapPin size={28} strokeWidth={1.5} aria-hidden="true" />
      <p className="text-sm">Map coming soon</p>
    </div>
  )
}

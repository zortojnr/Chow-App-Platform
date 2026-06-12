'use client'

// RestaurantMap — Track 7
//
// MapLibre GL map showing a restaurant's pinned location.
// Dynamically imported (no SSR) since MapLibre GL requires the browser's WebGL.
//
// - Shows amber pin marker at restaurant coordinates
// - Shows green dot at user's live position (when GPS granted)
// - Uses Stadia Maps Alidade Smooth tile set (no per-request billing)
// - Renders a location-unavailable placeholder when restaurant has no coordinates
//
// Governed by: track-07-navigation-location.md §9

import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { getMapStyle, MARKER_COLOR, USER_MARKER_COLOR, DEFAULT_ZOOM } from '@/lib/map-style'
import { useLocationStore } from 'features/location/stores/location.store'

interface RestaurantMapProps {
  latitude: number
  longitude: number
  restaurantName: string
  className?: string
}

export function RestaurantMap({
  latitude,
  longitude,
  restaurantName,
  className,
}: RestaurantMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const userMarkerRef = useRef<import('maplibre-gl').Marker | null>(null)

  const { latitude: userLat, longitude: userLng, permission } = useLocationStore()

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: import('maplibre-gl').Map

    import('maplibre-gl').then((ml) => {
      // MapLibre CSS — injected once
      if (!document.getElementById('maplibre-css')) {
        const link = document.createElement('link')
        link.id = 'maplibre-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css'
        document.head.appendChild(link)
      }

      map = new ml.Map({
        container: containerRef.current!,
        style: getMapStyle(),
        center: [longitude, latitude],
        zoom: DEFAULT_ZOOM,
        attributionControl: { compact: true },
      })

      // Restaurant marker
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
        .setPopup(new ml.Popup({ offset: 25 }).setText(restaurantName))
        .addTo(map)

      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, restaurantName])

  // Update user position marker whenever GPS state changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || permission !== 'granted' || userLat === null || userLng === null) return

    import('maplibre-gl').then((ml) => {
      // Remove old marker
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
    <div ref={containerRef} className={className ?? 'w-full h-64 rounded-xl overflow-hidden'} />
  )
}

// Shown on the restaurant profile when the restaurant has no coordinates yet
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

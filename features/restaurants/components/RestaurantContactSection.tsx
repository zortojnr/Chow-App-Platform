'use client'

// RestaurantContactSection — restaurant-listing-track.md §10.1–10.3
//
// Displays structured location and contact information for a restaurant profile.
//
// Location display (§10.1):
//   Area      — text-base neutral-700 (if present; e.g. "Lekki Phase 1")
//   Address   — text-base neutral-600 — tappable → Google Maps deep link (§10.3)
//   City, State — text-base neutral-500
//
// Address tap: opens native maps with text query (§10.3). This is the ONLY
// external navigation affordance in Phase 1. No "Navigate" or "Directions" CTA.
//
// Phone: tappable tel: link in the thumb zone.
// Website and email: shown if present, open in new tab.
//
// Phase 1 constraint (§10.2, §11.2): NO map embed, NO distance display, NO GPS.
//   The address/area/city fields are all the location data available in Phase 1.
//   The Google Maps deep link uses a text query — NOT a coordinate pin.
//
// Phase 2 compatibility (§11.3): the "Get directions" affordance at the bottom
// of this section is the future insertion point for in-product navigation.
// In Phase 1 it renders as the external maps link only.
//
// Skeleton: 3 lines of location text + 2 contact rows.

import { MapPin, Phone, Globe, Mail } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ─── Helpers ───────────────────────────────────────────────────

function mapsUrl(address: string, city: string): string {
  const query = encodeURIComponent(`${address}, ${city}`)
  return `https://maps.google.com/?q=${query}`
}

// ─── Types ─────────────────────────────────────────────────────

interface RestaurantContactSectionProps {
  phone:      string
  address:    string
  area:       string | null
  city:       string
  state:      string
  website:    string | null
  email:      string | null
  className?: string
}

// ─── Component ─────────────────────────────────────────────────

export function RestaurantContactSection({
  phone,
  address,
  area,
  city,
  state,
  website,
  email,
  className,
}: RestaurantContactSectionProps) {
  return (
    <section
      className={cn('space-y-5', className)}
      aria-label="Contact and location"
    >
      {/* ── Location ────────────────────────────────────── */}
      <div className="flex gap-3">
        <MapPin
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-neutral-500 mt-0.5"
          aria-hidden="true"
        />

        <div className="space-y-0.5 min-w-0">
          {/* Area — neighbourhood context (§9.4) */}
          {area && (
            <p className="text-base font-medium text-neutral-700">
              {area}
            </p>
          )}

          {/* Address — tappable, opens native maps (§10.3) */}
          <a
            href={mapsUrl(address, city)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'text-base text-neutral-600',
              'hover:text-amber-600 underline underline-offset-2 decoration-neutral-300',
              'hover:decoration-amber-500 transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:shadow-brand',
            )}
            aria-label={`${address} — open in maps`}
          >
            {address}
          </a>

          {/* City, State */}
          <p className="text-base text-neutral-500">
            {city}, {state}
          </p>
        </div>
      </div>

      {/* ── Phone ───────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Phone
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-neutral-500"
          aria-hidden="true"
        />
        <a
          href={`tel:${phone.replace(/\s/g, '')}`}
          className={cn(
            'text-base text-neutral-900 font-medium',
            'hover:text-amber-600 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:shadow-brand',
          )}
          aria-label={`Call ${phone}`}
        >
          {phone}
        </a>
      </div>

      {/* ── Website ─────────────────────────────────────── */}
      {website && (
        <div className="flex items-center gap-3">
          <Globe
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-neutral-500"
            aria-hidden="true"
          />
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'text-base text-neutral-700 truncate',
              'hover:text-amber-600 transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:shadow-brand',
            )}
            aria-label={`Visit website: ${website}`}
          >
            {website.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        </div>
      )}

      {/* ── Email ───────────────────────────────────────── */}
      {email && (
        <div className="flex items-center gap-3">
          <Mail
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-neutral-500"
            aria-hidden="true"
          />
          <a
            href={`mailto:${email}`}
            className={cn(
              'text-base text-neutral-700 truncate',
              'hover:text-amber-600 transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:shadow-brand',
            )}
            aria-label={`Email ${email}`}
          >
            {email}
          </a>
        </div>
      )}
    </section>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────

export function RestaurantContactSectionSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading contact information">
      {/* Location block */}
      <div className="flex gap-3">
        <div className="w-4 h-4 mt-0.5 shrink-0">
          <Skeleton className="w-full h-full rounded" />
        </div>
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
      </div>
      {/* Phone */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-4 h-4 rounded shrink-0" />
        <Skeleton className="h-4 w-36 rounded" />
      </div>
    </div>
  )
}

'use client'

// DishCard — restaurant-listing-track.md §4.2, §6.2
//
// Displays a dish as served at a specific restaurant.
//
// Visual hierarchy:
//   Left:  Dish name (Fraunces text-xl semibold) + nameAsServed alias (if different)
//          + category badge + availability + price
//   Right: "Confirmed" indicator (ShieldCheck + text) — only when isAdminVerified
//
// Trust signal (§6.2): isAdminVerified dishes show a "Confirmed" indicator with a
// subtle green-200 left accent border. Unverified dishes are still displayed
// (they were submitted by the owner) but carry no confirmation indicator.
//
// Availability display (§4.2):
//   ALWAYS_AVAILABLE → silent (default, expected baseline — showing it is noise)
//   SEASONAL         → amber badge "Seasonal"
//   WEEKEND_ONLY     → amber badge "Weekends only"
//   ON_ORDER         → neutral badge "On order"
//   UNKNOWN          → silent (don't surface uncertainty to consumers)
//
// Price: ₦ prefix, comma-formatted. Never "NGN" — §13.4.
// Category: formatted from SNAKE_CASE → "Title Case".
//
// Skeleton: name line + meta row — §16.3.

import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { DishSummary } from 'features/restaurants/services/restaurant-listing.service'

// ─── Availability ──────────────────────────────────────────────

const AVAILABILITY_LABEL: Partial<Record<string, string>> = {
  SEASONAL:     'Seasonal',
  WEEKEND_ONLY: 'Weekends only',
  ON_ORDER:     'On order',
}

// ─── Helpers ───────────────────────────────────────────────────

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

function formatPrice(raw: string): string {
  const n = parseFloat(raw)
  if (isNaN(n)) return `₦${raw}`
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}

// ─── Component ─────────────────────────────────────────────────

interface DishCardProps {
  dish:       DishSummary
  className?: string
}

export function DishCard({ dish, className }: DishCardProps) {
  const {
    canonicalName,
    nameAsServed,
    availabilityStatus,
    price,
    isAdminVerified,
    category,
  } = dish

  // nameAsServed alias — only shown when it genuinely differs from canonical name
  const alias = nameAsServed && nameAsServed !== canonicalName ? nameAsServed : null

  const availabilityLabel = AVAILABILITY_LABEL[availabilityStatus] ?? null

  return (
    <div
      className={cn(
        'bg-neutral-0 rounded-xl px-5 py-4',
        'border border-neutral-100',
        // Confirmed dishes get a subtle green left accent — trust made visible
        isAdminVerified && 'border-l-2 border-l-green-200',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* ── Left: dish information ────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Canonical name — Fraunces, display-weight heading */}
          <h4 className="font-display text-xl font-semibold text-neutral-900 leading-snug">
            {canonicalName}
          </h4>

          {/* How this restaurant calls it — shown only when genuinely different */}
          {alias && (
            <p className="mt-0.5 text-sm text-neutral-500 italic">
              "{alias}"
            </p>
          )}

          {/* Tags row: category · availability · price */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <Badge variant="category">{formatCategory(category)}</Badge>

            {availabilityLabel && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-medium bg-amber-50 text-amber-700"
                aria-label={`Availability: ${availabilityLabel}`}
              >
                {availabilityLabel}
              </span>
            )}

            {price && (
              <span
                className="text-sm font-semibold text-amber-700"
                aria-label={`Price: ${formatPrice(price)}`}
              >
                {formatPrice(price)}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: confirmed indicator ────────────────────── */}
        {isAdminVerified && (
          <div
            className="inline-flex items-center gap-1 shrink-0 text-green-700 mt-1"
            aria-label="Confirmed — this dish has been verified by a Chow Here admin"
            title="Confirmed by Chow Here"
          >
            <ShieldCheck size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-xs font-semibold">Confirmed</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────

export function DishCardSkeleton() {
  return (
    <div
      className="bg-neutral-0 rounded-xl px-5 py-4 border border-neutral-100"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-2/3 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-5 w-[86px] rounded-full shrink-0 mt-1" />
      </div>
    </div>
  )
}

// RestaurantDetailPanel — displays all intake fields for the review screen.
// Groups: restaurant info, location, contact, classification, description.
// DS §11.1 (admin density), §11.3 (type scale — text-sm/text-base, no Fraunces).
// Pure display — no mutations.

import { MapPin, Phone, Mail, Globe, Tag, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReviewDetail } from './review.types'

// ─── Label helpers ─────────────────────────────────────────────

const PRICE_RANGE_LABELS: Record<ReviewDetail['priceRange'], string> = {
  BUDGET:  '₦ Budget',
  MID:     '₦₦ Mid-range',
  UPSCALE: '₦₦₦ Upscale',
}

const PRICE_RANGE_VARIANTS: Record<ReviewDetail['priceRange'], 'price-budget' | 'price-mid' | 'price-upscale'> = {
  BUDGET:  'price-budget',
  MID:     'price-mid',
  UPSCALE: 'price-upscale',
}

// ─── Field row ─────────────────────────────────────────────────

function FieldRow({
  icon: Icon,
  label,
  value,
  mono = false,
  className,
}: {
  icon?: React.ElementType
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex gap-3 py-2.5 border-b border-[var(--admin-border)] last:border-0', className)}>
      {Icon && (
        <Icon
          size={15}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0 text-[var(--admin-text-tertiary)]"
          aria-hidden="true"
        />
      )}
      <div className="flex-1 min-w-0">
        <span className="block text-xs text-[var(--admin-text-tertiary)] uppercase tracking-wide mb-0.5">
          {label}
        </span>
        <span className={cn(
          'block text-base text-[var(--admin-text-primary)] break-words',
          mono && 'font-mono',
        )}>
          {value}
        </span>
      </div>
    </div>
  )
}

// ─── Section wrapper ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-b border-[var(--admin-border)]">
        <h3 className="text-xs font-semibold text-[var(--admin-text-tertiary)] uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="px-4">
        {children}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────

type Props = { restaurant: ReviewDetail }

export function RestaurantDetailPanel({ restaurant }: Props) {
  const {
    name, description, address, city, state, area,
    phone, email, website, priceRange, cuisineTypes, slug,
  } = restaurant

  return (
    <div className="space-y-4">

      {/* Restaurant info */}
      <Section title="Restaurant">
        <FieldRow label="Name" value={name} />
        {description && (
          <FieldRow label="Description" value={description} />
        )}
        <FieldRow
          label="Slug"
          value={<span className="font-mono text-sm">{slug}</span>}
        />
      </Section>

      {/* Location */}
      <Section title="Location">
        <FieldRow icon={MapPin} label="Address" value={address} />
        <FieldRow label="City" value={city} />
        <FieldRow label="State" value={state} />
        {area && <FieldRow label="Area / Neighbourhood" value={area} />}
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <FieldRow icon={Phone} label="Phone" value={
          <a
            href={`tel:${phone}`}
            className="text-amber-600 hover:underline font-mono text-sm"
          >
            {phone}
          </a>
        } />
        {email && (
          <FieldRow icon={Mail} label="Email" value={
            <a
              href={`mailto:${email}`}
              className="text-amber-600 hover:underline break-all"
            >
              {email}
            </a>
          } />
        )}
        {website && (
          <FieldRow icon={Globe} label="Website" value={
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:underline break-all"
            >
              {website}
            </a>
          } />
        )}
        {!email && !website && (
          <FieldRow label="Secondary contact" value={
            <span className="text-[var(--admin-text-tertiary)]">None provided</span>
          } />
        )}
      </Section>

      {/* Classification */}
      <Section title="Classification">
        <FieldRow icon={DollarSign} label="Price range" value={
          <Badge variant={PRICE_RANGE_VARIANTS[priceRange]}>
            {PRICE_RANGE_LABELS[priceRange]}
          </Badge>
        } />
        {cuisineTypes.length > 0 && (
          <FieldRow icon={Tag} label="Cuisine types" value={
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {cuisineTypes.map((t) => (
                <Badge key={t} variant="category">{t}</Badge>
              ))}
            </div>
          } />
        )}
      </Section>

    </div>
  )
}

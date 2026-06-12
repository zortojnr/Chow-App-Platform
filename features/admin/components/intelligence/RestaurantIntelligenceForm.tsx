// RestaurantIntelligenceForm — editable restaurant fields for the intelligence screen.
//
// UD-A: A2 pattern — section-level Edit button reveals a form.
// Single "Save Changes" action; Cancel exits without saving.
//
// Editable fields (IntelligenceUpdateSchema): description, phone, email,
// website, priceRange, area.
// Forbidden fields: name, slug, city, state, verificationStatus.
//
// PATCH /api/v1/admin/restaurants/:restaurantId/intelligence
// DS §10.2 inputs · §10.1 buttons · §11.1 admin density.

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, Phone, Mail, Globe, DollarSign, Tag, Pencil } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { IntelligenceUpdateSchema, type IntelligenceUpdateInput } from 'features/admin/schemas/intelligence.schema'
import { apiPatch } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ReviewDetail } from 'features/admin/components/review/review.types'

// ─── Helpers ──────────────────────────────────────────────────

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

// ─── Read-mode field row ───────────────────────────────────────

function FieldRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-[var(--admin-border)] last:border-0">
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
        <span className="block text-base text-[var(--admin-text-primary)] break-words">
          {value}
        </span>
      </div>
    </div>
  )
}

// ─── Input styles ──────────────────────────────────────────────

const inputBase = cn(
  'w-full rounded px-3 py-2 text-sm font-sans',
  'border border-neutral-200 bg-neutral-0 text-neutral-900',
  'placeholder:text-neutral-400',
  'focus:border-amber-500 focus:outline-none',
  'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
  'transition-[border-color,box-shadow] duration-[150ms] ease-out',
  'dark:bg-[var(--admin-bg-surface)] dark:text-[var(--admin-text-primary)]',
  'dark:border-[var(--admin-border)]',
)

const inputError = cn(
  'border-status-error bg-status-error-bg',
  'focus:border-status-error focus:[box-shadow:0_0_0_3px_rgba(192,57,43,0.20)]',
)

// ─── Component ────────────────────────────────────────────────

type Props = {
  restaurant: ReviewDetail
  restaurantId: string
  queryKey: unknown[]
}

export function RestaurantIntelligenceForm({ restaurant, restaurantId, queryKey }: Props) {
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<IntelligenceUpdateInput>({
    resolver: zodResolver(IntelligenceUpdateSchema),
    defaultValues: {
      description: restaurant.description ?? undefined,
      phone:       restaurant.phone,
      email:       restaurant.email ?? undefined,
      website:     restaurant.website ?? undefined,
      priceRange:  restaurant.priceRange,
      area:        restaurant.area ?? undefined,
    },
  })

  const priceRangeValue = watch('priceRange')

  const { mutate: save, isPending } = useMutation({
    mutationFn: (fields: IntelligenceUpdateInput) =>
      apiPatch(
        `/api/v1/admin/restaurants/${restaurantId}/intelligence`,
        fields,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.success('Restaurant details updated')
      setEditing(false)
    },
    onError: (err: Error) => {
      toast.error(`Update failed: ${err.message}`)
    },
  })

  const onSubmit = (data: IntelligenceUpdateInput) => {
    // Build payload with only dirty fields (PATCH semantics)
    const payload: Partial<IntelligenceUpdateInput> = {}
    if (dirtyFields.description !== undefined) payload.description = data.description ?? null
    if (dirtyFields.phone       !== undefined) payload.phone       = data.phone
    if (dirtyFields.email       !== undefined) payload.email       = data.email ?? null
    if (dirtyFields.website     !== undefined) payload.website     = data.website ?? null
    if (dirtyFields.priceRange  !== undefined) payload.priceRange  = data.priceRange
    if (dirtyFields.area        !== undefined) payload.area        = data.area ?? null
    if (Object.keys(payload).length === 0)    return
    save(payload)
  }

  const handleCancel = () => {
    reset()
    setEditing(false)
  }

  // ── Read mode ────────────────────────────────────────────────

  if (!editing) {
    return (
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-b border-[var(--admin-border)] flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[var(--admin-text-tertiary)] uppercase tracking-wide">
            Restaurant Details
          </h2>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setEditing(true)}
            className="gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
          >
            <Pencil size={12} strokeWidth={1.5} aria-hidden="true" />
            Edit
          </Button>
        </div>
        <div className="px-4">
          {restaurant.description ? (
            <FieldRow label="Description" value={restaurant.description} />
          ) : (
            <FieldRow label="Description" value={
              <span className="text-[var(--admin-text-tertiary)] italic text-sm">None provided</span>
            } />
          )}
          <FieldRow icon={Phone} label="Phone" value={
            <a href={`tel:${restaurant.phone}`} className="text-amber-600 hover:underline font-mono text-sm">
              {restaurant.phone}
            </a>
          } />
          {restaurant.email ? (
            <FieldRow icon={Mail} label="Email" value={
              <a href={`mailto:${restaurant.email}`} className="text-amber-600 hover:underline break-all">
                {restaurant.email}
              </a>
            } />
          ) : (
            <FieldRow icon={Mail} label="Email" value={
              <span className="text-[var(--admin-text-tertiary)] italic text-sm">None provided</span>
            } />
          )}
          {restaurant.website ? (
            <FieldRow icon={Globe} label="Website" value={
              <a href={restaurant.website} target="_blank" rel="noopener noreferrer"
                className="text-amber-600 hover:underline break-all">
                {restaurant.website}
              </a>
            } />
          ) : (
            <FieldRow icon={Globe} label="Website" value={
              <span className="text-[var(--admin-text-tertiary)] italic text-sm">None provided</span>
            } />
          )}
          <FieldRow icon={DollarSign} label="Price range" value={
            <Badge variant={PRICE_RANGE_VARIANTS[restaurant.priceRange]}>
              {PRICE_RANGE_LABELS[restaurant.priceRange]}
            </Badge>
          } />
          {restaurant.area && (
            <FieldRow icon={MapPin} label="Area / Neighbourhood" value={restaurant.area} />
          )}
        </div>
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-b border-[var(--admin-border)]">
        <h2 className="text-xs font-semibold text-[var(--admin-text-tertiary)] uppercase tracking-wide">
          Edit Restaurant Details
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-4 py-3 space-y-3">

          {/* Description */}
          <div>
            <label htmlFor="intel-description"
              className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">
              Description
            </label>
            <textarea
              id="intel-description"
              rows={3}
              placeholder="Describe the restaurant…"
              {...register('description')}
              className={cn(inputBase, 'resize-none', errors.description && inputError)}
              aria-describedby={errors.description ? 'intel-description-err' : undefined}
            />
            {errors.description && (
              <p id="intel-description-err" className="mt-1 text-xs text-status-error" role="alert">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="intel-phone"
              className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">
              Phone
            </label>
            <input
              id="intel-phone"
              type="tel"
              placeholder="e.g. 0801 234 5678"
              {...register('phone')}
              className={cn(inputBase, errors.phone && inputError)}
              aria-describedby={errors.phone ? 'intel-phone-err' : undefined}
            />
            {errors.phone && (
              <p id="intel-phone-err" className="mt-1 text-xs text-status-error" role="alert">
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="intel-email"
              className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">
              Email <span className="text-[var(--admin-text-tertiary)] font-normal">(optional)</span>
            </label>
            <input
              id="intel-email"
              type="email"
              placeholder="contact@restaurant.com"
              {...register('email')}
              className={cn(inputBase, errors.email && inputError)}
              aria-describedby={errors.email ? 'intel-email-err' : undefined}
            />
            {errors.email && (
              <p id="intel-email-err" className="mt-1 text-xs text-status-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Website */}
          <div>
            <label htmlFor="intel-website"
              className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">
              Website <span className="text-[var(--admin-text-tertiary)] font-normal">(optional)</span>
            </label>
            <input
              id="intel-website"
              type="url"
              placeholder="https://restaurant.com"
              {...register('website')}
              className={cn(inputBase, errors.website && inputError)}
              aria-describedby={errors.website ? 'intel-website-err' : undefined}
            />
            {errors.website && (
              <p id="intel-website-err" className="mt-1 text-xs text-status-error" role="alert">
                {errors.website.message}
              </p>
            )}
          </div>

          {/* Price range */}
          <div>
            <label htmlFor="intel-price-range"
              className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">
              Price range
            </label>
            <Select
              value={priceRangeValue}
              onValueChange={(v) =>
                setValue('priceRange', v as ReviewDetail['priceRange'], { shouldDirty: true })
              }
            >
              <SelectTrigger
                id="intel-price-range"
                aria-label="Price range"
                className={cn(errors.priceRange && 'border-status-error')}
              >
                <SelectValue placeholder="Select price range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUDGET">₦ Budget</SelectItem>
                <SelectItem value="MID">₦₦ Mid-range</SelectItem>
                <SelectItem value="UPSCALE">₦₦₦ Upscale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Area */}
          <div>
            <label htmlFor="intel-area"
              className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">
              Area / Neighbourhood <span className="text-[var(--admin-text-tertiary)] font-normal">(optional)</span>
            </label>
            <input
              id="intel-area"
              type="text"
              placeholder="e.g. Lekki Phase 1"
              {...register('area')}
              className={cn(inputBase, errors.area && inputError)}
              aria-describedby={errors.area ? 'intel-area-err' : undefined}
            />
            {errors.area && (
              <p id="intel-area-err" className="mt-1 text-xs text-status-error" role="alert">
                {errors.area.message}
              </p>
            )}
          </div>
        </div>

        {/* Form footer */}
        <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="trust"
            size="sm"
            isLoading={isPending}
            disabled={!isDirty}
            aria-busy={isPending}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}

// DishIntelligenceCard — Step 19 expanded dish row for the intelligence screen.
//
// Extends Step 18's DishVerifyCard with editing controls:
//   • Availability: immediate save on Select change (UD-E)
//   • Price: inline Save button (UD-E)
//   • nameAsServed: inline Save button; calls verifyDish() per UD-B
//
// Each field calls a distinct dispatch path in:
//   PATCH /api/v1/admin/restaurants/:restaurantId/dishes/:dishId/verify
//
// DS §11.1 every row is an action · §8.5 min-h-[56px] touch targets.

'use client'

import { useState } from 'react'
import { CheckCircle, Circle, Pencil, Check, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { apiPatch } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ReviewDish } from 'features/admin/components/review/review.types'

// ─── Constants ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  RICE_DISHES:  'Rice',
  SOUPS:        'Soups',
  SWALLOW:      'Swallow',
  PROTEIN:      'Protein',
  STREET_FOOD:  'Street food',
  DRINKS:       'Drinks',
  SNACKS:       'Snacks',
  BREAKFAST:    'Breakfast',
  DESSERTS:     'Desserts',
}

const AVAILABILITY_OPTIONS = [
  { value: 'ALWAYS_AVAILABLE', label: 'Always available' },
  { value: 'SEASONAL',         label: 'Seasonal'         },
  { value: 'WEEKEND_ONLY',     label: 'Weekends only'    },
  { value: 'ON_ORDER',         label: 'On order'         },
  { value: 'UNKNOWN',          label: 'Unknown'          },
] as const

function formatAge(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatPrice(price: string | null): string | null {
  if (!price) return null
  const n = parseFloat(price)
  if (isNaN(n)) return null
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Component ────────────────────────────────────────────────

type Props = {
  dish:         ReviewDish
  restaurantId: string
  queryKey:     unknown[]
}

export function DishIntelligenceCard({ dish, restaurantId, queryKey }: Props) {
  const queryClient = useQueryClient()
  const isVerified  = dish.verifiedAt !== null

  // nameAsServed inline edit state
  const [editingName, setEditingName]     = useState(false)
  const [nameDraft,   setNameDraft]       = useState(dish.nameAsServed ?? '')

  // price inline edit state
  const [editingPrice, setEditingPrice]   = useState(false)
  const [priceDraft,   setPriceDraft]     = useState(
    dish.price ? Math.round(parseFloat(dish.price)).toString() : '',
  )

  const invalidate = () => void queryClient.invalidateQueries({ queryKey })

  // ── Verify mutation (sets verifiedAt → score recalculates) ──
  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: () => apiPatch(
      `/api/v1/admin/restaurants/${restaurantId}/dishes/${dish.id}/verify`,
      { verifiedAt: new Date().toISOString() },
    ),
    onSuccess: () => {
      invalidate()
      toast.success(`"${dish.dish.canonicalName}" confirmed`)
    },
    onError: (err: Error) => toast.error(`Verify failed: ${err.message}`),
  })

  // ── nameAsServed mutation (UD-B: re-calls verifyDish, updates verifiedAt too) ──
  const { mutate: saveName, isPending: savingName } = useMutation({
    mutationFn: () => apiPatch(
      `/api/v1/admin/restaurants/${restaurantId}/dishes/${dish.id}/verify`,
      { nameAsServed: nameDraft.trim() || undefined },
    ),
    onSuccess: () => {
      invalidate()
      setEditingName(false)
      toast.success('Name as served updated')
    },
    onError: (err: Error) => toast.error(`Name update failed: ${err.message}`),
  })

  // ── Availability mutation (immediate on select, no score recalculation) ──
  const { mutate: saveAvailability, isPending: savingAvailability } = useMutation({
    mutationFn: (availabilityStatus: string) => apiPatch(
      `/api/v1/admin/restaurants/${restaurantId}/dishes/${dish.id}/verify`,
      { availabilityStatus },
    ),
    onSuccess: () => {
      invalidate()
      toast.success('Availability updated')
    },
    onError: (err: Error) => toast.error(`Availability update failed: ${err.message}`),
  })

  // ── Price mutation (inline save button, no score recalculation) ──
  const { mutate: savePrice, isPending: savingPrice } = useMutation({
    mutationFn: () => {
      const n = parseFloat(priceDraft)
      if (isNaN(n) || n <= 0) throw new Error('Enter a valid price greater than 0')
      return apiPatch(
        `/api/v1/admin/restaurants/${restaurantId}/dishes/${dish.id}/verify`,
        { price: n },
      )
    },
    onSuccess: () => {
      invalidate()
      setEditingPrice(false)
      toast.success('Price updated')
    },
    onError: (err: Error) => toast.error(`Price update failed: ${err.message}`),
  })

  const anyPending = verifying || savingName || savingAvailability || savingPrice

  return (
    <div
      className={cn(
        'px-4 py-3 min-h-[56px]',
        'border-b border-[var(--admin-border)] last:border-0',
        isVerified ? 'bg-green-50 [data-theme=dark_&]:bg-green-900/10' : 'bg-[var(--admin-bg-surface)]',
        'transition-colors duration-[200ms] ease-out',
      )}
    >
      <div className="flex items-start gap-3">

        {/* Verified indicator */}
        <div className="mt-1 shrink-0">
          {isVerified ? (
            <CheckCircle
              size={16}
              strokeWidth={1.5}
              className="text-green-500"
              aria-label={`${dish.dish.canonicalName} verified`}
            />
          ) : (
            <Circle
              size={16}
              strokeWidth={1.5}
              className="text-neutral-300"
              aria-label={`${dish.dish.canonicalName} not yet verified`}
            />
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">

          {/* Row 1: name + nameAsServed edit + category */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-[var(--admin-text-primary)] leading-snug">
              {dish.dish.canonicalName}
            </span>

            {/* nameAsServed inline edit */}
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Name as served…"
                  aria-label={`Edit name as served for ${dish.dish.canonicalName}`}
                  className={cn(
                    'h-7 px-2 text-sm font-sans rounded',
                    'border border-neutral-200 bg-neutral-0 text-neutral-900',
                    'placeholder:text-neutral-400',
                    'focus:border-amber-500 focus:outline-none',
                    'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
                    'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                    'w-32 sm:w-40',
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') { setEditingName(false); setNameDraft(dish.nameAsServed ?? '') }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => saveName()}
                  disabled={savingName}
                  aria-label="Save name as served"
                  className={cn(
                    'h-7 w-7 inline-flex items-center justify-center rounded',
                    'text-green-600 hover:bg-green-50',
                    'focus-visible:outline-none focus-visible:shadow-trust',
                    'transition-colors duration-[100ms]',
                    'disabled:opacity-40',
                  )}
                >
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingName(false); setNameDraft(dish.nameAsServed ?? '') }}
                  aria-label="Cancel name edit"
                  className={cn(
                    'h-7 w-7 inline-flex items-center justify-center rounded',
                    'text-[var(--admin-text-tertiary)] hover:bg-neutral-100',
                    'focus-visible:outline-none focus-visible:shadow-brand',
                    'transition-colors duration-[100ms]',
                  )}
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {dish.nameAsServed && dish.nameAsServed !== dish.dish.canonicalName && (
                  <span className="text-sm text-[var(--admin-text-secondary)]">
                    "{dish.nameAsServed}"
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setNameDraft(dish.nameAsServed ?? ''); setEditingName(true) }}
                  aria-label={`Edit name as served for ${dish.dish.canonicalName}`}
                  className={cn(
                    'h-5 w-5 inline-flex items-center justify-center rounded',
                    'text-[var(--admin-text-tertiary)] hover:text-amber-600 hover:bg-amber-50',
                    'focus-visible:outline-none focus-visible:shadow-brand',
                    'transition-colors duration-[100ms]',
                  )}
                >
                  <Pencil size={11} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            )}

            <Badge variant="category" className="text-xs">
              {CATEGORY_LABELS[dish.dish.category] ?? dish.dish.category}
            </Badge>
          </div>

          {/* Row 2: availability + price + verify status */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">

            {/* Availability select — immediate save (UD-E) */}
            <Select
              value={dish.availabilityStatus}
              onValueChange={(v) => saveAvailability(v)}
              disabled={anyPending}
            >
              <SelectTrigger
                className="h-7 text-xs px-2 w-36 border-neutral-200 bg-[var(--admin-bg-surface)]"
                aria-label={`Availability for ${dish.dish.canonicalName}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Price — inline save button (UD-E) */}
            {editingPrice ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--admin-text-tertiary)]">₦</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  placeholder="0"
                  aria-label={`Price for ${dish.dish.canonicalName}`}
                  className={cn(
                    'h-7 w-20 px-2 text-xs font-mono rounded text-right',
                    'border border-neutral-200 bg-neutral-0 text-neutral-900',
                    'focus:border-amber-500 focus:outline-none',
                    'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
                    'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') savePrice()
                    if (e.key === 'Escape') {
                      setEditingPrice(false)
                      setPriceDraft(dish.price ? Math.round(parseFloat(dish.price)).toString() : '')
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => savePrice()}
                  disabled={savingPrice}
                  aria-label="Save price"
                  className={cn(
                    'h-7 w-7 inline-flex items-center justify-center rounded',
                    'text-green-600 hover:bg-green-50',
                    'focus-visible:outline-none focus-visible:shadow-trust',
                    'transition-colors duration-[100ms]',
                    'disabled:opacity-40',
                  )}
                >
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPrice(false)
                    setPriceDraft(dish.price ? Math.round(parseFloat(dish.price)).toString() : '')
                  }}
                  aria-label="Cancel price edit"
                  className={cn(
                    'h-7 w-7 inline-flex items-center justify-center rounded',
                    'text-[var(--admin-text-tertiary)] hover:bg-neutral-100',
                    'focus-visible:outline-none focus-visible:shadow-brand',
                    'transition-colors duration-[100ms]',
                  )}
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingPrice(true)}
                disabled={anyPending}
                aria-label={`Edit price for ${dish.dish.canonicalName}`}
                className={cn(
                  'inline-flex items-center gap-1 h-7 px-2 rounded',
                  'text-xs text-[var(--admin-text-secondary)] hover:text-[var(--admin-text-primary)]',
                  'hover:bg-neutral-100',
                  'focus-visible:outline-none focus-visible:shadow-brand',
                  'transition-colors duration-[100ms]',
                  'disabled:opacity-40',
                )}
              >
                <span className="font-mono">
                  {formatPrice(dish.price) ?? <span className="text-[var(--admin-text-tertiary)] not-italic">No price</span>}
                </span>
                <Pencil size={11} strokeWidth={1.5} className="text-[var(--admin-text-tertiary)]" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Right: verify/verified */}
        <div className="shrink-0 mt-0.5">
          {!isVerified ? (
            <Button
              variant="secondary"
              size="sm"
              isLoading={verifying}
              onClick={() => verify()}
              aria-label={`Verify ${dish.dish.canonicalName}`}
              disabled={anyPending}
            >
              Verify
            </Button>
          ) : (
            <div className="text-right">
              <span className="text-xs font-medium text-green-600">Verified</span>
              <p className="text-xs text-[var(--admin-text-tertiary)]">
                {formatAge(dish.verifiedAt!)}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────

export function DishIntelligenceCardSkeleton() {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 min-h-[56px] border-b border-[var(--admin-border)] last:border-0"
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-4 rounded-full mt-0.5 shrink-0" static />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
      <Skeleton className="h-8 w-16 shrink-0" static />
    </div>
  )
}

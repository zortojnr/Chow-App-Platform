// DishVerifyCard — per-dish row for admin review and intelligence screens.
// Step 18 (review): verify-only (UD-1). Editing availability/price/nameAsServed is Step 19.
// Calls PATCH /api/v1/admin/restaurants/[restaurantId]/dishes/[dishId]/verify
// DS §11.1 (every row is an action), §10.1 (button states), §8.5 (48px min touch target).

'use client'

import { CheckCircle, Circle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiPatch } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ReviewDish } from 'features/admin/components/review/review.types'

// ─── Helpers ──────────────────────────────────────────────────

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

const AVAILABILITY_LABELS: Record<string, string> = {
  ALWAYS_AVAILABLE: 'Always available',
  SEASONAL:         'Seasonal',
  WEEKEND_ONLY:     'Weekends only',
  ON_ORDER:         'On order',
  UNKNOWN:          'Unknown',
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

export function DishVerifyCard({ dish, restaurantId, queryKey }: Props) {
  const queryClient = useQueryClient()
  const isVerified  = dish.verifiedAt !== null

  const { mutate: verify, isPending } = useMutation({
    mutationFn: () => apiPatch(
      `/api/v1/admin/restaurants/${restaurantId}/dishes/${dish.id}/verify`,
      { verifiedAt: new Date().toISOString() },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.success(`"${dish.dish.canonicalName}" marked as verified`)
    },
    onError: (err: Error) => {
      toast.error(`Verification failed: ${err.message}`)
    },
  })

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 min-h-[48px]',
        'border-b border-[var(--admin-border)] last:border-0',
        isVerified ? 'bg-green-50' : 'bg-[var(--admin-bg-surface)]',
        'transition-colors duration-[200ms] ease-out',
      )}
    >
      {/* Verified indicator */}
      {isVerified ? (
        <CheckCircle
          size={18}
          strokeWidth={1.5}
          className="shrink-0 text-green-500"
          aria-hidden="true"
        />
      ) : (
        <Circle
          size={18}
          strokeWidth={1.5}
          className="shrink-0 text-neutral-300"
          aria-hidden="true"
        />
      )}

      {/* Dish name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-base font-semibold leading-snug truncate',
            'text-[var(--admin-text-primary)]',
          )}>
            {dish.dish.canonicalName}
          </span>
          {dish.nameAsServed && dish.nameAsServed !== dish.dish.canonicalName && (
            <span className="text-sm text-[var(--admin-text-secondary)]">
              "{dish.nameAsServed}"
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant="category" className="text-xs">
            {CATEGORY_LABELS[dish.dish.category] ?? dish.dish.category}
          </Badge>
          <span className="text-xs text-[var(--admin-text-tertiary)]">
            {AVAILABILITY_LABELS[dish.availabilityStatus] ?? dish.availabilityStatus}
          </span>
          {formatPrice(dish.price) && (
            <span className="font-mono text-xs text-[var(--admin-text-secondary)]">
              {formatPrice(dish.price)}
            </span>
          )}
        </div>
      </div>

      {/* Verify button — shown only when not yet verified */}
      {!isVerified ? (
        <Button
          variant="secondary"
          size="sm"
          isLoading={isPending}
          onClick={() => verify()}
          aria-label={`Verify ${dish.dish.canonicalName}`}
          className="shrink-0"
        >
          Verify
        </Button>
      ) : (
        <span className="shrink-0 text-xs font-medium text-green-600">
          Verified
        </span>
      )}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────

import { Skeleton } from '@/components/ui/skeleton'

export function DishVerifyCardSkeleton() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 min-h-[48px] border-b border-[var(--admin-border)] last:border-0"
      aria-hidden="true"
    >
      <Skeleton className="h-4.5 w-4.5 rounded-full" static />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-16" static />
    </div>
  )
}

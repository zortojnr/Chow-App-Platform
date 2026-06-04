// Badge — design-system-v1.md §10.4
// All badges: pill-shaped (radius-full), text-xs semibold, height 22px, padding 4px 10px.
// Variants cover all VerificationStatus values, price ranges, category, and amber (queue count).

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  // Base — shared across all badge variants §10.4
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold select-none',
  {
    variants: {
      variant: {
        // VerificationStatus badges — §2.1 Verification Status Colors
        verified:    'bg-green-50  text-green-700',   // APPROVED
        pending:     'bg-amber-50  text-amber-700',   // PENDING_REVIEW
        'needs-info':'bg-status-info-bg text-status-info', // NEEDS_INFO
        draft:       'bg-neutral-100 text-neutral-500',  // DRAFT
        rejected:    'bg-status-error-bg text-status-error', // REJECTED

        // Price range badges §10.4
        'price-budget':  'bg-neutral-100 text-neutral-600',
        'price-mid':     'bg-amber-50  text-amber-700',
        'price-upscale': 'bg-neutral-900 text-neutral-50',

        // Category badge §10.4
        category: 'bg-neutral-100 text-neutral-700',

        // Amber — resolved UNRESOLVED-1: queue count badge in sidebar nav item
        amber: 'bg-amber-500 text-neutral-0',

        // Neutral — generic fallback
        neutral: 'bg-neutral-100 text-neutral-700',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

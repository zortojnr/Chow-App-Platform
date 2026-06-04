// VerificationStatusBadge — maps VerificationStatus enum to DS §10.4 badge variants.
// Admin language from DS §11.5: "Verified" for APPROVED, "Not Approved" for REJECTED.
// Shared component: used in queue (Step 17), review screen (Step 18), intelligence (Step 19).
// dynamic prop adds role="status" for contexts where the badge updates in place. §8.4

import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'

// String literal union — avoids importing Prisma client in a shared UI component
export type VerificationStatusValue =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED'

type BadgeVariant = NonNullable<BadgeProps['variant']>

const STATUS_CONFIG: Record<VerificationStatusValue, { variant: BadgeVariant; label: string }> = {
  DRAFT:          { variant: 'draft',       label: 'Draft' },
  PENDING_REVIEW: { variant: 'pending',     label: 'Pending Review' },
  NEEDS_INFO:     { variant: 'needs-info',  label: 'Needs Information' },
  APPROVED:       { variant: 'verified',    label: 'Verified' },
  REJECTED:       { variant: 'rejected',    label: 'Not Approved' },
}

type Props = {
  status:     VerificationStatusValue
  dynamic?:   boolean
  className?: string
}

export function VerificationStatusBadge({ status, dynamic = false, className }: Props) {
  const { variant, label } = STATUS_CONFIG[status]
  return (
    <Badge
      variant={variant}
      className={className}
      role={dynamic ? 'status' : undefined}
      aria-label={`Verification status: ${label}`}
    >
      {label}
    </Badge>
  )
}

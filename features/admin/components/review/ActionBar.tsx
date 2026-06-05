// ActionBar — sticky bottom action bar for the admin review screen.
// DS §11.4 action hierarchy: Approve (trust, right) | Request Info (primary, center) | Reject (ghost, left).
// DS §8.5: all buttons ≥ 44px touch target. Sticky bottom-0 with neutral-0 bg + top border.
// Action availability varies by verificationStatus (see architecture validation §4).

'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApproveModal }   from './modals/ApproveModal'
import { RejectModal }    from './modals/RejectModal'
import { NeedsInfoModal } from './modals/NeedsInfoModal'
import { ReopenModal }    from './modals/ReopenModal'
import { cn } from '@/lib/utils'
import type { VerificationStatusValue } from 'features/verification/components/VerificationStatusBadge'

// ─── Types ────────────────────────────────────────────────────

type Props = {
  restaurantId:    string
  restaurantName:  string
  status:          VerificationStatusValue
  confidenceScore: number
  internalNotes:   string | null
  isSuperAdmin:    boolean   // kept for future use; override modal is in ReviewContent
  queryKey:        unknown[]
}

// ─── Component ────────────────────────────────────────────────

export function ActionBar({
  restaurantId,
  restaurantName,
  status,
  confidenceScore,
  internalNotes,
  isSuperAdmin,
  queryKey,
}: Props) {
  const [openModal, setOpenModal] = useState<
    'approve' | 'reject' | 'needs-info' | 'reopen' | 'override' | null
  >(null)

  const close = () => setOpenModal(null)

  // Status determines which actions are available
  const isRejected = status === 'REJECTED'
  const isDraft    = status === 'DRAFT'
  const isApproved = status === 'APPROVED'

  if (isDraft) return null

  return (
    <>
      {/* Sticky action bar */}
      <div
        className={cn(
          'sticky bottom-0 z-10',
          'bg-[var(--admin-bg-surface)] border-t border-[var(--admin-border)]',
          'px-6 py-4',
        )}
      >
        {isRejected ? (
          // REJECTED: single Re-open button
          <div className="flex items-center justify-center">
            <Button
              variant="secondary"
              onClick={() => setOpenModal('reopen')}
              className="gap-2"
            >
              <RotateCcw size={15} strokeWidth={1.5} aria-hidden="true" />
              Re-open Review
            </Button>
          </div>
        ) : (
          // PENDING_REVIEW, NEEDS_INFO, APPROVED: three-action bar
          <div className="flex items-center justify-between gap-3 flex-wrap">

            {/* Left: Reject — DS §11.4 Ghost variant, leftmost */}
            <Button
              variant="ghost"
              onClick={() => setOpenModal('reject')}
              className="text-status-error hover:bg-status-error-bg hover:text-status-error"
            >
              Reject
            </Button>

            {/* Center: Request Info — DS §11.4 Secondary variant */}
            <Button
              variant="secondary"
              onClick={() => setOpenModal('needs-info')}
            >
              Request Info
            </Button>

            {/* Right: Approve — DS §11.4 Trust variant, rightmost */}
            <Button
              variant="trust"
              disabled={isApproved}
              onClick={() => setOpenModal('approve')}
              title={isApproved ? 'Already approved' : undefined}
            >
              Approve
            </Button>
          </div>
        )}
      </div>

      {/* Modals — rendered outside the bar to avoid z-index issues */}
      <ApproveModal
        open={openModal === 'approve'}
        onClose={close}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        confidenceScore={confidenceScore}
        internalNotes={internalNotes}
        queryKey={queryKey}
      />

      <RejectModal
        open={openModal === 'reject'}
        onClose={close}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        queryKey={queryKey}
      />

      <NeedsInfoModal
        open={openModal === 'needs-info'}
        onClose={close}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        queryKey={queryKey}
      />

      <ReopenModal
        open={openModal === 'reopen'}
        onClose={close}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        queryKey={queryKey}
      />

    </>
  )
}

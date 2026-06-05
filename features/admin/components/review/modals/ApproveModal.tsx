// ApproveModal — DS §10.6 dialog (sm, 480px). DS §11.4 action hierarchy: Trust variant.
// Blocking error when projected score < 0.40 — no confirm button shown per architecture.
// internalNotes pre-populated as optional notes field (UD-2).
// POST /api/v1/admin/verification/[restaurantId]/approve { notes?: string }

'use client'

import { CheckCircle, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'

// Projected post-approval score = current score + S4 weight (0.25)
// Threshold: must be >= 0.40
const S4_WEIGHT = 0.25
const APPROVAL_THRESHOLD = 0.40

type Props = {
  open:          boolean
  onClose:       () => void
  restaurantId:  string
  restaurantName: string
  confidenceScore: number    // numeric (pre-approval, S4 not yet included)
  internalNotes: string | null
  queryKey:      unknown[]
}

export function ApproveModal({
  open, onClose, restaurantId, restaurantName, confidenceScore, internalNotes, queryKey,
}: Props) {
  const [notes, setNotes] = useState(internalNotes ?? '')
  const queryClient       = useQueryClient()

  const projectedScore = confidenceScore + S4_WEIGHT
  const isBlocked      = projectedScore < APPROVAL_THRESHOLD

  const { mutate: approve, isPending } = useMutation({
    mutationFn: () => apiPost(
      `/api/v1/admin/verification/${restaurantId}/approve`,
      notes.trim() ? { notes: notes.trim() } : {},
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] })
      toast.success(`Approved — ${restaurantName} is now live.`)
      onClose()
    },
    onError: (err: Error) => {
      toast.error(`Approval failed: ${err.message}`)
    },
  })

  // Reset notes when dialog opens with fresh internalNotes
  const handleOpenChange = (open: boolean) => {
    if (!open) { onClose(); setNotes(internalNotes ?? '') }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm" aria-labelledby="approve-modal-title">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle
              size={20}
              strokeWidth={1.5}
              className="text-green-500 shrink-0"
              aria-hidden="true"
            />
            <DialogTitle id="approve-modal-title">
              Approve {restaurantName}?
            </DialogTitle>
          </div>
          <DialogDescription>
            This will publish the listing on Chow Here.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">

          {/* Projected score */}
          <div className={cn(
            'rounded-lg px-4 py-3 text-sm',
            isBlocked
              ? 'bg-status-error-bg border border-status-error'
              : 'bg-green-50 border border-green-200',
          )}>
            {isBlocked ? (
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={15}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0 text-status-error"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-neutral-900">Cannot approve</p>
                  <p className="text-neutral-600 mt-0.5">
                    Projected confidence score is{' '}
                    <span className="font-mono font-semibold text-status-error">
                      {Math.round(projectedScore * 100)}%
                    </span>
                    . Minimum required is{' '}
                    <span className="font-mono font-semibold">
                      {Math.round(APPROVAL_THRESHOLD * 100)}%
                    </span>
                    . Verify more data before approving.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-neutral-700">
                Projected confidence score after approval:{' '}
                <span className="font-mono font-semibold text-green-700">
                  {Math.round(projectedScore * 100)}%
                </span>
              </p>
            )}
          </div>

          {/* Internal notes — only shown when not blocked */}
          {!isBlocked && (
            <div>
              <label
                htmlFor="approve-notes"
                className="block text-sm font-medium text-[var(--admin-text-primary)] mb-1.5"
              >
                Internal notes{' '}
                <span className="text-[var(--admin-text-tertiary)] font-normal">(optional)</span>
              </label>
              <textarea
                id="approve-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add internal notes for this decision…"
                className={cn(
                  'w-full rounded px-3 py-2.5 text-sm font-sans resize-none',
                  'border border-neutral-200 bg-neutral-0 text-neutral-900',
                  'placeholder:text-neutral-400',
                  'focus:border-amber-500 focus:outline-none',
                  'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
                  'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                )}
                aria-describedby="approve-notes-hint"
              />
              <p id="approve-notes-hint" className="mt-1 text-xs text-[var(--admin-text-tertiary)]">
                Not visible to the submitter.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {!isBlocked && (
            <Button
              variant="trust"
              isLoading={isPending}
              onClick={() => approve()}
              aria-busy={isPending}
            >
              Confirm Approval
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

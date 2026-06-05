// RejectModal — DS §10.6 dialog (default, 640px). DS §11.4: Destructive variant.
// Reason is required (min 10 chars, enforced client-side before Submit enabled).
// POST /api/v1/admin/verification/[restaurantId]/reject { reason: string }

'use client'

import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'

const MIN_REASON_CHARS = 10

type Props = {
  open:           boolean
  onClose:        () => void
  restaurantId:   string
  restaurantName: string
  queryKey:       unknown[]
}

export function RejectModal({
  open, onClose, restaurantId, restaurantName, queryKey,
}: Props) {
  const [reason, setReason] = useState('')
  const queryClient         = useQueryClient()
  const canSubmit           = reason.trim().length >= MIN_REASON_CHARS

  const { mutate: reject, isPending } = useMutation({
    mutationFn: () => apiPost(
      `/api/v1/admin/verification/${restaurantId}/reject`,
      { reason: reason.trim() },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] })
      toast.error(`Rejected — ${restaurantName} has been declined.`)
      setReason('')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(`Rejection failed: ${err.message}`)
    },
  })

  const handleOpenChange = (open: boolean) => {
    if (!open) { onClose(); setReason('') }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-labelledby="reject-modal-title">
        <DialogHeader>
          <DialogTitle id="reject-modal-title">
            Reject {restaurantName}?
          </DialogTitle>
          <DialogDescription>
            The submitter will be notified with your reason.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-status-error bg-status-error-bg px-4 py-3">
            <AlertCircle
              size={16}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0 text-status-error"
              aria-hidden="true"
            />
            <p className="text-sm text-neutral-700">
              <span className="font-semibold">This will remove the restaurant from search. </span>
              The submission can be re-opened later if needed.
            </p>
          </div>

          {/* Reason textarea */}
          <div>
            <label
              htmlFor="reject-reason"
              className="block text-sm font-medium text-[var(--admin-text-primary)] mb-1.5"
            >
              Reason for rejection
              <span className="text-status-error ml-1" aria-hidden="true">*</span>
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Describe why this submission is not approved…"
              required
              aria-required="true"
              aria-describedby="reject-reason-hint"
              className={cn(
                'w-full rounded px-3 py-2.5 text-sm font-sans resize-none',
                'border border-neutral-200 bg-neutral-0 text-neutral-900',
                'placeholder:text-neutral-400',
                'focus:border-amber-500 focus:outline-none',
                'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
                'transition-[border-color,box-shadow] duration-[150ms] ease-out',
              )}
            />
            <p id="reject-reason-hint" className="mt-1 text-xs text-[var(--admin-text-tertiary)]">
              Minimum {MIN_REASON_CHARS} characters.
              {' '}{reason.trim().length < MIN_REASON_CHARS && reason.length > 0 && (
                <span className="text-status-warning">
                  {MIN_REASON_CHARS - reason.trim().length} more needed.
                </span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            isLoading={isPending}
            disabled={!canSubmit}
            onClick={() => reject()}
            aria-busy={isPending}
          >
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

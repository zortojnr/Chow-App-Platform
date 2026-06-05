// OverrideScoreModal — SUPER-only manual confidence score override.
// DS §10.6 dialog (sm, 480px). Reason required (min 10 chars). Score 0–100 input.
// POST /api/v1/admin/verification/[restaurantId]/score/override { score, reason }
// confidence-scoring-spec.md §6 — override does NOT change status. Score is
// overwritten on next automatic recalculation trigger.

'use client'

import { ShieldAlert } from 'lucide-react'
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
  open:            boolean
  onClose:         () => void
  restaurantId:    string
  currentScore:    number
  queryKey:        unknown[]
}

export function OverrideScoreModal({
  open, onClose, restaurantId, currentScore, queryKey,
}: Props) {
  const [scoreInput, setScoreInput] = useState(Math.round(currentScore * 100).toString())
  const [reason, setReason]         = useState('')
  const queryClient                 = useQueryClient()

  const scoreNum    = parseFloat(scoreInput) / 100
  const scoreValid  = !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 1
  const reasonValid = reason.trim().length >= MIN_REASON_CHARS
  const canSubmit   = scoreValid && reasonValid

  const { mutate: override, isPending } = useMutation({
    mutationFn: () => apiPost(
      `/api/v1/admin/verification/${restaurantId}/score/override`,
      { score: scoreNum, reason: reason.trim() },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.success(`Score overridden to ${Math.round(scoreNum * 100)}%.`)
      setScoreInput('')
      setReason('')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(`Override failed: ${err.message}`)
    },
  })

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      setScoreInput(Math.round(currentScore * 100).toString())
      setReason('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm" aria-labelledby="override-score-modal-title">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert
              size={20}
              strokeWidth={1.5}
              className="text-amber-500 shrink-0"
              aria-hidden="true"
            />
            <DialogTitle id="override-score-modal-title">
              Override confidence score
            </DialogTitle>
          </div>
          <DialogDescription>
            Super admin only. The override will be cleared on the next data change.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">

          {/* Score input */}
          <div>
            <label
              htmlFor="override-score"
              className="block text-sm font-medium text-[var(--admin-text-primary)] mb-1.5"
            >
              New score (0–100)
              <span className="text-status-error ml-1" aria-hidden="true">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="override-score"
                type="number"
                min="0"
                max="100"
                step="1"
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                className={cn(
                  'w-24 h-10 rounded px-3 text-sm font-mono text-center',
                  'border border-neutral-200 bg-neutral-0 text-neutral-900',
                  'focus:border-amber-500 focus:outline-none',
                  'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
                  'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                  !scoreValid && scoreInput !== '' && 'border-status-error bg-status-error-bg',
                )}
                aria-describedby="override-score-hint"
              />
              <span className="text-sm text-[var(--admin-text-secondary)]">%</span>
              <span className="text-xs text-[var(--admin-text-tertiary)] ml-1">
                Current: <span className="font-mono">{Math.round(currentScore * 100)}%</span>
              </span>
            </div>
            <p id="override-score-hint" className="mt-1 text-xs text-[var(--admin-text-tertiary)]">
              Enter a value between 0 and 100.
            </p>
          </div>

          {/* Reason textarea */}
          <div>
            <label
              htmlFor="override-reason"
              className="block text-sm font-medium text-[var(--admin-text-primary)] mb-1.5"
            >
              Reason
              <span className="text-status-error ml-1" aria-hidden="true">*</span>
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this score being overridden?"
              required
              aria-required="true"
              className={cn(
                'w-full rounded px-3 py-2.5 text-sm font-sans resize-none',
                'border border-neutral-200 bg-neutral-0 text-neutral-900',
                'placeholder:text-neutral-400',
                'focus:border-amber-500 focus:outline-none',
                'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
                'transition-[border-color,box-shadow] duration-[150ms] ease-out',
              )}
            />
            <p className="mt-1 text-xs text-[var(--admin-text-tertiary)]">
              Minimum {MIN_REASON_CHARS} characters. Logged in the audit trail.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={isPending}
            disabled={!canSubmit}
            onClick={() => override()}
            aria-busy={isPending}
          >
            Apply Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

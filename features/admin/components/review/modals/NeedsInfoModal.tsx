// NeedsInfoModal — DS §10.6 dialog (default, 640px). DS §11.4: Primary (center) variant.
// feedbackToSubmitter is required (min 10 chars). Submitter receives the text by email.
// POST /api/v1/admin/verification/[restaurantId]/needs-info { feedbackToSubmitter: string }

'use client'

import { MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'

const MIN_FEEDBACK_CHARS = 10

type Props = {
  open:           boolean
  onClose:        () => void
  restaurantId:   string
  restaurantName: string
  queryKey:       unknown[]
}

export function NeedsInfoModal({
  open, onClose, restaurantId, restaurantName, queryKey,
}: Props) {
  const [feedback, setFeedback] = useState('')
  const queryClient             = useQueryClient()
  const canSubmit               = feedback.trim().length >= MIN_FEEDBACK_CHARS

  const { mutate: requestInfo, isPending } = useMutation({
    mutationFn: () => apiPost(
      `/api/v1/admin/verification/${restaurantId}/needs-info`,
      { feedbackToSubmitter: feedback.trim() },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] })
      toast.success('Request sent — the submitter has been emailed.')
      setFeedback('')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(`Request failed: ${err.message}`)
    },
  })

  const handleOpenChange = (open: boolean) => {
    if (!open) { onClose(); setFeedback('') }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-labelledby="needs-info-modal-title">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MessageSquare
              size={20}
              strokeWidth={1.5}
              className="text-amber-500 shrink-0"
              aria-hidden="true"
            />
            <DialogTitle id="needs-info-modal-title">
              Request more information
            </DialogTitle>
          </div>
          <DialogDescription>
            Your message will be sent to the submitter of{' '}
            <span className="font-semibold text-neutral-900">{restaurantName}</span> by email.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">

          {/* Feedback textarea */}
          <div>
            <label
              htmlFor="needs-info-feedback"
              className="block text-sm font-medium text-[var(--admin-text-primary)] mb-1.5"
            >
              Message to submitter
              <span className="text-status-error ml-1" aria-hidden="true">*</span>
            </label>
            <textarea
              id="needs-info-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="What information do you need from them?"
              required
              aria-required="true"
              aria-describedby="needs-info-hint"
              className={cn(
                'w-full rounded px-3 py-2.5 text-sm font-sans resize-none',
                'border border-neutral-200 bg-neutral-0 text-neutral-900',
                'placeholder:text-neutral-400',
                'focus:border-amber-500 focus:outline-none',
                'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
                'transition-[border-color,box-shadow] duration-[150ms] ease-out',
              )}
            />
            <p id="needs-info-hint" className="mt-1 text-xs text-[var(--admin-text-tertiary)]">
              The submitter will receive a response link valid for 14 days.
              {feedback.trim().length < MIN_FEEDBACK_CHARS && feedback.length > 0 && (
                <span className="text-status-warning ml-1">
                  {MIN_FEEDBACK_CHARS - feedback.trim().length} more characters needed.
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
            variant="primary"
            isLoading={isPending}
            disabled={!canSubmit}
            onClick={() => requestInfo()}
            aria-busy={isPending}
          >
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

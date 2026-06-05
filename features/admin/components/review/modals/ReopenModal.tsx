// ReopenModal — REJECTED → PENDING_REVIEW transition. UD-3: no reason required.
// DS §10.6 dialog (sm, 480px). No-reason confirmation modal per UD-3.
// POST /api/v1/admin/verification/[restaurantId]/reopen
// VerificationService.reopen() handles the state transition atomically.

'use client'

import { RotateCcw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiPost } from '@/lib/api'

type Props = {
  open:           boolean
  onClose:        () => void
  restaurantId:   string
  restaurantName: string
  queryKey:       unknown[]
}

export function ReopenModal({
  open, onClose, restaurantId, restaurantName, queryKey,
}: Props) {
  const queryClient = useQueryClient()

  const { mutate: reopen, isPending } = useMutation({
    mutationFn: () => apiPost(
      `/api/v1/admin/verification/${restaurantId}/reopen`,
      {},
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] })
      toast.success(`${restaurantName} has been returned to the review queue.`)
      onClose()
    },
    onError: (err: Error) => {
      toast.error(`Re-open failed: ${err.message}`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="sm" aria-labelledby="reopen-modal-title">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <RotateCcw
              size={20}
              strokeWidth={1.5}
              className="text-amber-500 shrink-0"
              aria-hidden="true"
            />
            <DialogTitle id="reopen-modal-title">
              Re-open {restaurantName}?
            </DialogTitle>
          </div>
          <DialogDescription>
            This will return the restaurant to the review queue.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={isPending}
            onClick={() => reopen()}
            aria-busy={isPending}
          >
            Re-open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

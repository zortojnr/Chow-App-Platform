// DuplicateWarningBanner — conditional amber alert for submissions with possible duplicates.
// Shown when internalNotes contains duplicate candidate information (set by intake.service).
// DS §17.5 admin error patterns — informative, specific reason included.

import { AlertTriangle } from 'lucide-react'

type Props = {
  internalNotes: string | null
}

// Intake service flags duplicates in internalNotes with a specific prefix.
const DUPLICATE_PREFIX = 'Possible duplicate'

export function DuplicateWarningBanner({ internalNotes }: Props) {
  if (!internalNotes?.includes(DUPLICATE_PREFIX)) return null

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-status-warning bg-status-warning-bg px-4 py-3"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle
        size={16}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 text-status-warning"
        aria-hidden="true"
      />
      <div className="text-sm">
        <span className="font-semibold text-neutral-900">Possible duplicate detected. </span>
        <span className="text-neutral-600">
          Review the internal notes and check existing listings before approving.
        </span>
      </div>
    </div>
  )
}

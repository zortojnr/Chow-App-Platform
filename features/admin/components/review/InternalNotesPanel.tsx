// InternalNotesPanel — read-only display of admin internal notes.
// Per UD-2: notes are editable only during transition actions (passed as
// initialNotes to each action modal). No standalone save endpoint.
// DS §11.1 admin density — compact, informative.

import { StickyNote } from 'lucide-react'

type Props = {
  notes: string | null
}

export function InternalNotesPanel({ notes }: Props) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-surface)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--admin-bg-subtle)] border-b border-[var(--admin-border)] flex items-center gap-2">
        <StickyNote size={14} strokeWidth={1.5} className="text-[var(--admin-text-tertiary)]" aria-hidden="true" />
        <h3 className="text-xs font-semibold text-[var(--admin-text-tertiary)] uppercase tracking-wide">
          Internal Notes
        </h3>
        <span className="text-xs text-[var(--admin-text-tertiary)] ml-auto">Admin only</span>
      </div>
      <div className="px-4 py-3">
        {notes ? (
          <p className="text-sm text-[var(--admin-text-secondary)] whitespace-pre-wrap leading-relaxed">
            {notes}
          </p>
        ) : (
          <p className="text-sm text-[var(--admin-text-tertiary)] italic">
            No internal notes. Add a note via Approve, Reject, or Request Info.
          </p>
        )}
      </div>
    </div>
  )
}

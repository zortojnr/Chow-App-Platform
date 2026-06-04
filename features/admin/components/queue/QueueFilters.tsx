// QueueFilters — admin verification queue filter bar.
// DS §10.2 (inputs, selects), §11.1 (admin density — compact h-9 controls).
// Parent manages URL search params and provides values + callbacks — this component
// is presentational. All filter changes reset to page 1.

'use client'

import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'NEEDS_INFO',     label: 'Needs Information' },
  { value: 'APPROVED',       label: 'Verified' },
  { value: 'REJECTED',       label: 'Not Approved' },
  { value: 'DRAFT',          label: 'Draft' },
]

const SORT_OPTIONS = [
  { value: 'oldest', label: 'Oldest first' },
  { value: 'newest', label: 'Newest first' },
]

const ASSIGNED_OPTIONS = [
  { value: 'all',        label: 'All submissions' },
  { value: 'me',         label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned only' },
]

// ─── Types ────────────────────────────────────────────────────

export type QueueFilterValues = {
  status:     string
  sort:       string
  assignedTo: string
  city:       string
}

type QueueFiltersProps = {
  values:     QueueFilterValues
  onChange:   (patch: Partial<QueueFilterValues>) => void
  onClear:    () => void
  isFiltered: boolean
}

// ─── Component ────────────────────────────────────────────────

export function QueueFilters({ values, onChange, onClear, isFiltered }: QueueFiltersProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="search"
      aria-label="Queue filters"
    >

      {/* Status — default: PENDING_REVIEW */}
      <Select
        value={values.status}
        onValueChange={(v) => onChange({ status: v })}
      >
        <SelectTrigger
          className="h-9 w-auto min-w-[160px] text-sm"
          aria-label="Filter by verification status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-sm">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        value={values.sort}
        onValueChange={(v) => onChange({ sort: v })}
      >
        <SelectTrigger
          className="h-9 w-auto min-w-[136px] text-sm"
          aria-label="Sort order"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-sm">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assigned To */}
      <Select
        value={values.assignedTo}
        onValueChange={(v) => onChange({ assignedTo: v })}
      >
        <SelectTrigger
          className="h-9 w-auto min-w-[156px] text-sm"
          aria-label="Filter by assignment"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSIGNED_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-sm">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* City — text input with inline clear */}
      <div className="relative">
        <input
          type="text"
          placeholder="City..."
          value={values.city}
          onChange={(e) => onChange({ city: e.target.value })}
          className={cn(
            'h-9 rounded px-3 text-sm font-sans',
            values.city ? 'pr-7' : 'pr-3',
            'w-32',
            'border border-neutral-200 bg-neutral-0 text-neutral-900',
            'placeholder:text-neutral-400',
            'focus:border-amber-500 focus:outline-none',
            'focus:[box-shadow:0_0_0_3px_rgba(212,116,10,0.24)]',
            'transition-[border-color,box-shadow] duration-[150ms] ease-out',
          )}
          aria-label="Filter by city"
        />
        {values.city && (
          <button
            type="button"
            onClick={() => onChange({ city: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 text-neutral-400 hover:text-neutral-700 transition-colors duration-[100ms]"
            aria-label="Clear city filter"
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Clear all — visible only when non-default filters are active */}
      {isFiltered && (
        <button
          type="button"
          onClick={onClear}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 rounded text-sm font-medium',
            'border border-neutral-200 bg-neutral-0 text-neutral-600',
            'hover:bg-neutral-50 hover:text-neutral-900',
            'transition-colors duration-[100ms] ease-out',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500',
          )}
        >
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  )
}

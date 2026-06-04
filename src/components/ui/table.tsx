// Table — design-system-v1.md §10.7
// Admin table spec:
//   Header row:  neutral-100 bg, text-sm font-semibold neutral-500, uppercase tracking
//   Body rows:   neutral-0 bg, text-base neutral-900
//   Hover row:   neutral-50 bg, 100ms ease-out
//   Selected row: amber-50 bg
//   Dividers:    1px solid neutral-100 (horizontal only)
//   Cell padding: 12px 16px (py-3 px-4)
//   No vertical dividers. No outer border.
//
// Semantic HTML first: role="table" with scope="col" on headers. §8.4

import * as React from 'react'
import { cn } from '@/lib/utils'

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-base', className)}
      role="table"
      {...props}
    />
  </div>
))
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('bg-neutral-100', className)}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('bg-neutral-100 font-medium', className)}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { isSelected?: boolean }
>(({ className, isSelected = false, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      // Horizontal divider only — no outer border, no vertical dividers §10.7
      'border-b border-neutral-100',
      // Row hover: neutral-50 bg, 100ms ease-out §10.7 §7.4
      'transition-colors duration-[100ms] ease-out',
      'hover:bg-neutral-50',
      // Selected state: amber-50 bg §10.7
      isSelected && 'bg-amber-50',
      className,
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    // text-sm font-semibold neutral-500 uppercase tracking §10.7
    className={cn(
      'h-10 px-4 text-left text-sm font-semibold text-neutral-500',
      'tracking-wide uppercase',
      'align-middle',
      className,
    )}
    scope="col"   // §8.4 — required for table accessibility
    {...props}
  />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    // Cell padding: 12px 16px (py-3 px-4) §10.7
    className={cn('py-3 px-4 align-middle text-neutral-900', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-neutral-500', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

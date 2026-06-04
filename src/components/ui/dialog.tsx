// Dialog — design-system-v1.md §10.6
// Width: 480px (sm), 640px (default), 800px (wide).
// Radius: radius-2xl (20px). Shadow: shadow-xl.
// Backdrop: rgba(26,23,20,0.48) blur 4px.
// Structure: Header (title + close) | Divider | Content | Divider | Footer.
// Focus trap: handled by Radix. Focus returns to trigger on close. §8.3

'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Backdrop: rgba(26,23,20,0.48) blur 4px §10.6
      'fixed inset-0 z-50 bg-[rgba(26,23,20,0.48)] backdrop-blur-[4px]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: 'sm' | 'default' | 'wide'
  }
>(({ className, children, size = 'default', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Positioning
        'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
        // Surface: neutral-0, radius-2xl, shadow-xl §10.6
        'bg-neutral-0 rounded-2xl shadow-xl',
        // Width by size variant §10.6
        size === 'sm'      && 'w-full max-w-[480px]',
        size === 'default' && 'w-full max-w-[640px]',
        size === 'wide'    && 'w-full max-w-[800px]',
        'max-h-[90vh] overflow-y-auto',
        // Entry animation: 300ms ease-out §7.4
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=open]:zoom-in-[0.97]',
        'data-[state=open]:duration-[300ms]',
        // Exit animation: 200ms ease-in §7.4
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'data-[state=closed]:zoom-out-95',
        'data-[state=closed]:duration-[200ms]',
        className,
      )}
      // §8.4 — required ARIA on modal dialogs
      role="dialog"
      aria-modal="true"
      {...props}
    >
      {children}
      {/* Close button — always top-right §10.6 */}
      <DialogPrimitive.Close
        className={cn(
          'absolute right-4 top-4',
          'inline-flex h-8 w-8 items-center justify-center rounded',
          'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100',
          'transition-colors duration-[100ms] ease-out',
          'focus-visible:outline-none focus-visible:shadow-brand',
        )}
        aria-label="Close dialog"
      >
        <X size={18} strokeWidth={1.5} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-1 px-6 pt-6 pb-4', className)}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200',
      className,
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-xl font-semibold text-neutral-900', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-base text-neutral-600', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

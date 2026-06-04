// Sonner Toaster — design-system-v1.md §10.8
// Position: bottom-right (desktop), bottom-center (mobile).
// Z-index: highest (z-[9999]).
// Toast types: success (green-500 left border), error (status-error left border),
//              warning (status-warning left border), info (status-info left border).
// Auto-dismiss: 4s info/success, 8s warning/error (set per toast call, not here).
// Entry: 300ms ease-spring. Exit: 200ms ease-in. §7.4

'use client'

import { Toaster as SonnerToaster } from 'sonner'

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      // Gap between stacked toasts
      gap={8}
      toastOptions={{
        classNames: {
          toast: [
            'group flex items-start gap-3',
            'w-[360px] rounded-lg p-4 shadow-md',
            'bg-neutral-0 border-l-[3px]',
            'text-base text-neutral-900 font-sans',
          ].join(' '),
          title:       'text-base font-semibold text-neutral-900',
          description: 'text-sm text-neutral-600',
          success:     'border-l-green-500',
          error:       'border-l-status-error',
          warning:     'border-l-status-warning',
          info:        'border-l-status-info',
          // Close button
          closeButton: [
            'text-neutral-400 hover:text-neutral-700',
            'transition-colors duration-[100ms]',
          ].join(' '),
        },
      }}
      // Responsive: bottom-center on narrow viewports is handled
      // by consumers using sonner's mobilePosition prop if needed.
      {...props}
    />
  )
}

export { Toaster }

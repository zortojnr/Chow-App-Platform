// Button — design-system-v1.md §10.1
// 6 variants × 5 sizes. All states (hover, press, focus, loading, disabled) specified.
// Focus ring: shadow-brand (amber halo) — never outline.
// Press: scale(0.98) transform via active: modifier.

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base — shared across all variants
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-semibold select-none cursor-pointer',
    'rounded-md',                                   // radius-md = 10px §5
    'transition-colors duration-[100ms]',           // §7.4 button hover: 100ms
    'focus-visible:outline-none focus-visible:shadow-brand',
    'active:scale-[0.98] active:transition-transform active:duration-[100ms]',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  ),
  {
    variants: {
      variant: {
        // Primary — amber-500 fill, white text. The one CTA per screen. §10.1
        primary:
          'bg-amber-500 text-neutral-0 hover:bg-amber-600',

        // Secondary — white surface, neutral border. Supporting actions. §10.1
        secondary:
          'bg-neutral-0 text-neutral-900 border border-neutral-300 hover:bg-neutral-50',

        // Ghost — transparent, neutral text. Tertiary actions. §10.1
        ghost:
          'bg-transparent text-neutral-700 hover:bg-neutral-100',

        // Trust — green-500, white text. Approve, verify, confirm. §10.1
        trust:
          'bg-green-500 text-neutral-0 hover:bg-green-600 focus-visible:shadow-trust',

        // Destructive — status-error fill. Irreversible actions. §10.1
        destructive:
          'bg-status-error text-neutral-0 hover:bg-status-error/90',

        // Outline Brand — transparent with amber border. §10.1
        'outline-brand':
          'bg-transparent text-amber-500 border border-amber-500 hover:bg-amber-50',
      },
      size: {
        // xs: 28px height, 12px h-padding, text-xs semibold. Admin compact. §10.1
        xs:      'h-7 px-3 text-xs',
        // sm: 32px height, 16px h-padding, text-sm semibold. Dense UI. §10.1
        sm:      'h-8 px-4 text-sm',
        // default: 40px height, 20px h-padding, text-base. Standard. §10.1
        default: 'h-10 px-5 text-base',
        // lg: 48px height, 24px h-padding, text-md. Primary CTAs. §10.1
        lg:      'h-12 px-6 text-md',
        // xl: 56px height, 32px h-padding, text-lg. Hero CTAs. §10.1
        xl:      'h-14 px-8 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  // asChild renders the button as its child element (e.g. <Link>).
  asChild?: boolean
  // isLoading disables the button and shows a spinner. §10.1
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            {/* 16px spinner — white on brand buttons, amber on ghost. §10.1 */}
            <svg
              className="animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              width={16}
              height={16}
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="sr-only">Loading</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }

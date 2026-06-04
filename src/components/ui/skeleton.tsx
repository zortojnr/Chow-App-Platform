// Skeleton — design-system-v1.md §16.2
// Replaces content blocks at their exact dimensions during loading.
// Color: neutral-200. Shimmer: diagonal gradient, 1400ms ease-in-out infinite.
// Reduced motion: prefers-reduced-motion stops the shimmer (static neutral-200).

import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  // When true, suppresses the shimmer (useful for non-content-area skeletons).
  static?: boolean
}

function Skeleton({ className, static: isStatic = false, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded bg-neutral-200',
        !isStatic && [
          'bg-[length:200%_100%]',
          'motion-safe:animate-[shimmer_1.4s_ease-in-out_infinite]',
          'motion-safe:bg-gradient-to-r',
          'motion-safe:from-neutral-200 motion-safe:via-neutral-100 motion-safe:to-neutral-200',
        ],
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }

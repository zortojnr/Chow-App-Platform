import Image from 'next/image'
import { cn } from '@/lib/utils'

type BrandWordmarkProps = {
  className?: string
  showMark?: boolean
  onDark?: boolean
}

export function BrandWordmark({ className, showMark = false, onDark = false }: BrandWordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 leading-none', className)}>
      {showMark && (
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white">
          <Image src="/asset-2.webp" alt="" aria-hidden="true" width={18} height={25} />
        </span>
      )}
      <span className="inline-flex items-baseline gap-1">
        <span className="text-amber-500">Chow</span>
        <span className={onDark ? 'text-green-400' : 'text-green-700'}>Here</span>
      </span>
    </span>
  )
}
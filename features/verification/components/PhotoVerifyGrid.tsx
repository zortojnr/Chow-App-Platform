// PhotoVerifyGrid — admin photo grid with per-photo verify and set-primary controls.
// DS §10.10: 3-col desktop, 2-col tablet. Hover: dark overlay with action buttons.
// Verify: PATCH isVerified=true. Set Primary: PATCH isVerified=true + isPrimary=true.
// DS §8.4: each photo needs alt text and labelled action buttons.
// Shared between Step 18 (review) and Step 19 (intelligence).

'use client'

import { Crown, CheckCircle, Camera } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiPatch } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ReviewPhoto } from 'features/admin/components/review/review.types'

// ─── Single photo cell ─────────────────────────────────────────

type PhotoCellProps = {
  photo:        ReviewPhoto
  index:        number
  restaurantId: string
  queryKey:     unknown[]
}

function PhotoCell({ photo, index, restaurantId, queryKey }: PhotoCellProps) {
  const queryClient = useQueryClient()

  const { mutate: patchPhoto, isPending } = useMutation({
    mutationFn: (body: { isVerified: boolean; isPrimary?: boolean }) =>
      apiPatch(
        `/api/v1/admin/restaurants/${restaurantId}/photos/${photo.id}/verify`,
        body,
      ),
    onSuccess: (_, body) => {
      void queryClient.invalidateQueries({ queryKey })
      if (body.isPrimary) toast.success('Photo set as primary')
      else if (body.isVerified) toast.success('Photo marked as verified')
    },
    onError: (err: Error) => {
      toast.error(`Photo action failed: ${err.message}`)
    },
  })

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
      {/* Photo */}
      <img
        src={photo.url}
        alt={photo.caption ?? `Restaurant photo ${index + 1}`}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />

      {/* Verified badge — bottom-right, always visible when verified */}
      {photo.isVerified && (
        <div className="absolute bottom-2 right-2">
          <CheckCircle
            size={20}
            strokeWidth={1.5}
            className="text-green-500 drop-shadow-sm"
            aria-label="Verified photo"
          />
        </div>
      )}

      {/* Primary crown — top-left, always visible when primary */}
      {photo.isPrimary && (
        <div className="absolute top-2 left-2">
          <Crown
            size={18}
            strokeWidth={1.5}
            className="text-amber-400 drop-shadow-sm"
            aria-label="Primary photo"
          />
        </div>
      )}

      {/* Hover overlay with action buttons */}
      <div className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-2',
        'bg-[rgba(26,23,20,0.54)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        'transition-opacity duration-[100ms] ease-out',
      )}>
        {isPending ? (
          <div className="inline-flex items-center justify-center w-8 h-8">
            <svg
              className="animate-spin text-neutral-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              width={20}
              height={20}
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            {!photo.isVerified && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => patchPhoto({ isVerified: true })}
                aria-label={`Verify photo ${index + 1}`}
                className="bg-neutral-0/90 text-neutral-900 hover:bg-neutral-0 border-0 shadow-sm text-xs h-8 px-3"
              >
                Verify
              </Button>
            )}
            {photo.isVerified && !photo.isPrimary && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => patchPhoto({ isVerified: true, isPrimary: true })}
                aria-label={`Set photo ${index + 1} as primary`}
                className="bg-neutral-0/90 text-neutral-900 hover:bg-neutral-0 border-0 shadow-sm text-xs h-8 px-3"
              >
                Set Primary
              </Button>
            )}
            {photo.isVerified && photo.isPrimary && (
              <span className="text-xs text-neutral-0/80 font-medium">Primary</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Grid ─────────────────────────────────────────────────────

type Props = {
  photos:       ReviewPhoto[]
  restaurantId: string
  queryKey:     unknown[]
}

export function PhotoVerifyGrid({ photos, restaurantId, queryKey }: Props) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <Camera
          size={32}
          strokeWidth={1.5}
          className="text-neutral-300"
          aria-hidden="true"
        />
        <p className="text-2xl font-semibold text-neutral-800 font-sans">No photos yet</p>
        <p className="text-base text-neutral-600">
          Photos can be added during submission or by an admin.
        </p>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-3 gap-3"
      role="list"
      aria-label="Restaurant photos"
    >
      {photos.map((photo, i) => (
        <div key={photo.id} role="listitem">
          <PhotoCell
            photo={photo}
            index={i}
            restaurantId={restaurantId}
            queryKey={queryKey}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────

export function PhotoVerifyGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-3 gap-3"
      aria-busy="true"
      aria-label="Loading photos"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  )
}

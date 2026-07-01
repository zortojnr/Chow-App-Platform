'use client'

// /dashboard/saved — Track 5 §6
//
// Track 4 §7.3 explicitly deferred this page to Track 5. Reuses existing
// tokens/patterns (card shell from SearchRestaurantCard, empty state from
// design-system-v1.md §15.2 "Consumer saved dishes — none" row) rather than
// inventing new visual language.
//
// Governed by: track-05-user-accounts.md §6

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bookmark, MapPin, UtensilsCrossed } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SavedDishListItem } from 'features/accounts/services/saved-dish.service'

type SavedDishesResponse = { success: true; data: SavedDishListItem[] }

async function fetchSavedDishes(): Promise<SavedDishListItem[]> {
  const res = await fetch('/api/v1/users/saved-dishes')
  if (!res.ok) throw new Error('Failed to load saved dishes')
  const json: SavedDishesResponse = await res.json()
  return json.data
}

export default function SavedDishesPage() {
  const { status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/dashboard/saved')
    }
  }, [status, router])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['saved-dishes'],
    queryFn: fetchSavedDishes,
    enabled: status === 'authenticated',
  })

  async function handleUnsave(savedDishId: string) {
    try {
      const res = await fetch(`/api/v1/users/saved-dishes/${savedDishId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('unsave failed')
      queryClient.setQueryData<SavedDishListItem[]>(['saved-dishes'], (prev) =>
        prev?.filter((item) => item.id !== savedDishId),
      )
    } catch {
      toast.error('Could not remove — please try again')
    }
  }

  if (status !== 'authenticated') return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-neutral-900 mb-6">
        Saved Dishes
      </h1>

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-neutral-0 shadow-sm rounded-xl overflow-hidden" aria-busy="true">
              <Skeleton className="w-full aspect-[4/3] rounded-none rounded-t-xl" />
              <div className="p-4 space-y-2.5">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-error">Could not load your saved dishes — please try again.</p>
      )}

      {/* Empty state — design-system-v1.md §15.2 "Consumer saved dishes — none" */}
      {!isLoading && !isError && data?.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 px-6 text-center min-h-[400px]"
          role="status"
        >
          <div
            className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-6"
            aria-hidden="true"
          >
            <Bookmark size={32} strokeWidth={1.5} className="text-amber-500" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-neutral-800 mb-2">
            Nothing saved yet
          </h2>
          <p className="text-base text-neutral-600 max-w-sm mb-6">
            When you find dishes you love, save them here.
          </p>
          <Link
            href="/search"
            className={cn(
              'inline-flex items-center justify-center h-11 px-6 rounded-[10px]',
              'bg-amber-500 text-neutral-0 text-base font-semibold',
              'transition-colors duration-fast hover:bg-amber-600',
              'focus-visible:outline-none focus-visible:shadow-brand',
            )}
          >
            Start searching
          </Link>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.map((item) => (
            <div
              key={item.id}
              className="group relative bg-neutral-0 rounded-xl shadow-sm hover:shadow transition-all duration-normal ease-out overflow-hidden"
            >
              <button
                onClick={() => handleUnsave(item.id)}
                className={cn(
                  'absolute top-3 right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center',
                  'bg-amber-500 text-neutral-0 hover:bg-amber-600 transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:shadow-brand',
                )}
                aria-label={`Unsave ${item.dish.nameAsServed ?? item.dish.canonicalName} at ${item.restaurant.name}`}
              >
                <Bookmark size={16} strokeWidth={0} fill="currentColor" aria-hidden="true" />
              </button>

              <Link href={`/restaurants/${item.restaurant.slug}`} className="block focus-visible:outline-none focus-visible:shadow-brand">
                <div className="relative overflow-hidden aspect-[4/3] rounded-t-xl bg-neutral-100">
                  {item.restaurant.thumbnailUrl ? (
                    <img
                      src={item.restaurant.thumbnailUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full" aria-hidden="true">
                      <UtensilsCrossed size={36} strokeWidth={1.5} className="text-neutral-300" />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-display text-xl font-semibold text-neutral-900 leading-tight mb-1.5 line-clamp-1 pr-8">
                    {item.restaurant.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin size={13} strokeWidth={1.5} className="shrink-0 text-neutral-400" aria-hidden="true" />
                    <span className="text-sm text-neutral-600 truncate">
                      {item.restaurant.area ? `${item.restaurant.area} · ${item.restaurant.city}` : item.restaurant.city}
                    </span>
                  </div>
                  <div className="py-2 border-t border-neutral-100">
                    <p className="text-sm font-medium text-neutral-800 line-clamp-1">
                      {item.dish.nameAsServed ?? item.dish.canonicalName}
                    </p>
                    {item.dish.price && (
                      <span className="text-xs text-neutral-400">₦{item.dish.price}</span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

// useSavedDish — real save/unsave against the Track 5 API.
// Replaces the Track 4 in-memory stub. Interface is unchanged
// ({ isSaved, isPending, toggle }) so SearchRestaurantCard needs no edits.
//
// Governed by: track-04-search-discovery.md §7.3–§7.5, track-05-user-accounts.md §5.2

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { useSavedDishesStore } from 'features/accounts/stores/saved-dishes.store'

export function useSavedDish(restaurantDishId: string) {
  const { status } = useSession()
  const { savedDishMap, hydrate, markSaved, markUnsaved } = useSavedDishesStore()
  const [isPending, setIsPending] = useState(false)

  const isSaved = savedDishMap.has(restaurantDishId)

  useEffect(() => {
    if (status === 'authenticated') hydrate()
  }, [status, hydrate])

  const toggle = async () => {
    if (status === 'unauthenticated') {
      toast.error('Sign in to save dishes')
      return
    }

    setIsPending(true)

    if (!isSaved) {
      // Optimistic update with a placeholder id — swapped for the real
      // SavedDish.id once the request resolves (track-04 §7.3).
      markSaved(restaurantDishId, restaurantDishId)
      try {
        const res = await fetch('/api/v1/users/saved-dishes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantDishId }),
        })
        if (!res.ok && res.status !== 409) throw new Error('save failed')
        const json = await res.json().catch(() => null)
        if (json?.data?.id) markSaved(restaurantDishId, json.data.id)
        toast.success('Saved')
      } catch {
        markUnsaved(restaurantDishId)
        toast.error('Could not save — please try again')
      } finally {
        setIsPending(false)
      }
      return
    }

    // Unsave
    const savedDishId = savedDishMap.get(restaurantDishId)
    markUnsaved(restaurantDishId)
    try {
      if (!savedDishId) return
      const res = await fetch(`/api/v1/users/saved-dishes/${savedDishId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('unsave failed')
    } catch {
      markSaved(restaurantDishId, savedDishId ?? restaurantDishId)
      toast.error('Could not save — please try again')
    } finally {
      setIsPending(false)
    }
  }

  return { isSaved, isPending, toggle }
}

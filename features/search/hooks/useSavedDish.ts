'use client'

// useSavedDish — optimistic save/unsave stub.
// Track 5 will wire the real /api/v1/users/saved-dishes endpoint.
// Phase 1: bookmark is present but shows "Sign in to save" for
// unauthenticated users and a silent stub for authenticated ones.
//
// Governed by: track-04-search-discovery.md §7.4, §14.4, Step 11

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

export function useSavedDish(_restaurantDishId: string) {
  const { status } = useSession()
  const [isSaved, setIsSaved]     = useState(false)
  const [isPending, setIsPending] = useState(false)

  const toggle = () => {
    if (status === 'unauthenticated') {
      toast.error('Sign in to save dishes')
      return
    }
    // Optimistic update — Track 5 replaces this with a real mutation
    setIsSaved((prev) => !prev)
    setIsPending(true)
    setTimeout(() => setIsPending(false), 300)
  }

  return { isSaved, isPending, toggle }
}

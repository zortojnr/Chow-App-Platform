'use client'

// ArrivalBanner — Track 7
//
// Shows a celebration banner when the user's GPS position indicates they
// have arrived at the restaurant (distanceKm < ARRIVAL_THRESHOLD_KM = 0.15).
//
// Animated in with Framer Motion. Dismissible. Shows once per restaurant visit
// (dismissed state is component-local, cleared on unmount).
//
// Design: green-500 background (trust colour), checkmark icon.
// Governed by: track-07-navigation-location.md §8.3

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, X } from 'lucide-react'

interface ArrivalBannerProps {
  restaurantName: string
  hasArrived: boolean
}

export function ArrivalBanner({ restaurantName, hasArrived }: ArrivalBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  return (
    <AnimatePresence>
      {hasArrived && !dismissed && (
        <motion.div
          key="arrival-banner"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 px-4 py-3 bg-green-500 text-neutral-0 rounded-xl mb-4"
        >
          <CheckCircle size={20} aria-hidden="true" className="shrink-0" />
          <p className="flex-1 text-sm font-medium">
            You&apos;ve arrived at {restaurantName}!
          </p>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss arrival notification"
            className="shrink-0 opacity-80 hover:opacity-100 transition-opacity focus-visible:outline-none"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

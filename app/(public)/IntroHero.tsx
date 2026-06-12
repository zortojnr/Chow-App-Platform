'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { HeroVideoSection } from './HeroVideoSection'
import { TypewriterText } from './TypewriterText'
import {
  getShouldShowWelcomeIntro,
  markWelcomeIntroSeen,
} from '@/lib/welcome-intro'

// Intro timeline constants (in seconds)
const TYPEWRITER_START = 0.3
const TYPEWRITER_DURATION = 1.8
const TRANSITION_START = 2.8 // after typewriter completes + hold
const TRANSITION_DURATION = 1.2
const TOTAL_INTRO_TIME = TRANSITION_START + TRANSITION_DURATION

interface IntroHeroProps {
  city?: string
}

export default function IntroHero({ city }: IntroHeroProps) {
  const reduceMotion = useReducedMotion()
  const [showIntro, setShowIntro] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (reduceMotion) {
      setShowIntro(false)
      return
    }

    const shouldShowIntro = getShouldShowWelcomeIntro()
    setShowIntro(shouldShowIntro)
    if (!shouldShowIntro) return

    let transitionTimer: ReturnType<typeof setTimeout>
    let exitTimer: ReturnType<typeof setTimeout>

    // Start transition after welcome text settles
    transitionTimer = setTimeout(() => {
      setIsTransitioning(true)
      // Remove intro overlay after transition animation completes
      exitTimer = setTimeout(() => {
        setShowIntro(false)
        markWelcomeIntroSeen()
      }, TRANSITION_DURATION * 1000)
    }, TRANSITION_START * 1000)

    return () => {
      clearTimeout(transitionTimer)
      clearTimeout(exitTimer)
    }
  }, [reduceMotion])

  // Intro container: fullscreen initially, then lifts and fades while the hero slides in.
  const introContainerVariants = {
    initial: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    transition: {
      opacity: 0.28,
      y: -20,
      scale: 0.96,
    },
  }

  return (
    <div className="relative min-h-screen bg-neutral-50">
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro-overlay"
            initial="initial"
            animate={isTransitioning ? 'transition' : 'initial'}
            exit={{
              opacity: 0,
              y: -28,
              scale: 0.92,
              transition: { duration: 0.3, ease: 'easeOut' },
            }}
            variants={introContainerVariants}
            transition={{ duration: TRANSITION_DURATION, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-black origin-top"
            aria-hidden={true}
          >
            <div className="absolute inset-0 bg-black" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/40" />

            {/* Welcome text with typewriter effect */}
            <div className="relative z-10 px-6 text-center max-w-2xl">
              <TypewriterText
                text="Welcome to Chow Here"
                duration={TYPEWRITER_DURATION}
                delay={TYPEWRITER_START}
                as="h2"
                className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white drop-shadow-lg"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero section with fluid entrance during transition */}
      <motion.div
        className="relative z-0"
        initial={{ opacity: 0, y: 28, scale: 1.03 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: TRANSITION_DURATION,
          delay: TRANSITION_START,
          ease: 'easeOut',
        }}
      >
        <HeroVideoSection city={city} />
      </motion.div>
    </div>
  )
}

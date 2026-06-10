'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { HeroVideoSection } from './HeroVideoSection'
import { TypewriterText } from './TypewriterText'

const HERO_VIDEO_SRC = 'https://res.cloudinary.com/dzr18sd58/video/upload/v1781097458/Ramen_ingredients_transforming_i__202606101416_h6lyzl.mp4'

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
  const [showIntro, setShowIntro] = useState(!reduceMotion)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [heroPlay, setHeroPlay] = useState(false)

  useEffect(() => {
    if (reduceMotion) {
      setShowIntro(false)
      setHeroPlay(true)
      return
    }

    let transitionTimer: ReturnType<typeof setTimeout>
    let exitTimer: ReturnType<typeof setTimeout>

    // Start transition after welcome text settles
    transitionTimer = setTimeout(() => {
      setIsTransitioning(true)
      setHeroPlay(true)
      // Remove intro overlay after transition animation completes
      exitTimer = setTimeout(() => {
        setShowIntro(false)
      }, TRANSITION_DURATION * 1000)
    }, TRANSITION_START * 1000)

    return () => {
      clearTimeout(transitionTimer)
      clearTimeout(exitTimer)
    }
  }, [reduceMotion])

  const handleVideoError = () => {
    setIsTransitioning(true)
    setHeroPlay(true)
    setTimeout(() => {
      setShowIntro(false)
    }, 300)
  }

  // Intro container: fullscreen initially, scales down to hero size during transition
  const introContainerVariants = {
    initial: {
      scale: 1,
    },
    transition: {
      scale: 0.48,
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
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            variants={introContainerVariants}
            transition={{ duration: TRANSITION_DURATION, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-black origin-top"
            aria-hidden={true}
          >
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={HERO_VIDEO_SRC}
              autoPlay
              muted
              playsInline
              preload="auto"
              onError={handleVideoError}
            />

            {/* Gradient overlay */}
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

      {/* Hero section with fade-in animation during transition */}
      <motion.div
        className="relative z-0"
        initial={{ opacity: heroPlay ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: TRANSITION_DURATION,
          delay: TRANSITION_START,
          ease: 'easeOut',
        }}
      >
        <HeroVideoSection city={city} playVideo={heroPlay} />
      </motion.div>
    </div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { HeroVideoSection } from './HeroVideoSection'

const HERO_VIDEO_SRC = 'https://res.cloudinary.com/dzr18sd58/video/upload/v1781097458/Ramen_ingredients_transforming_i__202606101416_h6lyzl.mp4'

interface IntroHeroProps {
  city?: string
}

export default function IntroHero({ city }: IntroHeroProps) {
  const reduceMotion = useReducedMotion()
  const [showIntro, setShowIntro] = useState(!reduceMotion)
  const [isExiting, setIsExiting] = useState(false)
  const [heroPlay, setHeroPlay] = useState(false)

  useEffect(() => {
    if (reduceMotion) {
      // Skip intro for users who prefer reduced motion
      setShowIntro(false)
      setHeroPlay(true)
      return
    }

    let introTimer: ReturnType<typeof setTimeout>
    let exitTimer: ReturnType<typeof setTimeout>

    // Total intro display: ~2s (video settles) before starting transition
    introTimer = setTimeout(() => {
      setIsExiting(true)
      // allow exit animation to complete before removing overlay and starting hero video
      exitTimer = setTimeout(() => {
        setShowIntro(false)
        setHeroPlay(true)
      }, 700)
    }, 2000)

    return () => {
      clearTimeout(introTimer)
      clearTimeout(exitTimer)
    }
  }, [reduceMotion])

  // If video fails to load, immediately skip intro
  const handleVideoError = () => {
    setIsExiting(true)
    setTimeout(() => {
      setShowIntro(false)
      setHeroPlay(true)
    }, 300)
  }

  const overlayVariants = {
    initial: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96, filter: 'blur(3px)' },
  }

  const welcomeVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7 } },
  }

  return (
    <div className="relative min-h-screen bg-neutral-50">
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro-overlay"
            initial="initial"
            animate={isExiting ? 'exit' : 'initial'}
            exit="exit"
            variants={overlayVariants}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
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

            <div className="absolute inset-0 bg-black/30" />

            <div className="relative z-10 px-6 text-center">
              <motion.h2
                initial="hidden"
                animate="visible"
                variants={welcomeVariants}
                className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white drop-shadow-lg"
              >
                Welcome to Chow Here
              </motion.h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HeroSection lives underneath the intro overlay. It will begin playing its video
          once the intro completes (heroPlay=true). */}
      <div className="relative z-0">
        <HeroVideoSection city={city} playVideo={heroPlay} />
      </div>
    </div>
  )
}

'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { SearchBar } from 'features/search/components/SearchBar'

const HERO_VIDEO_SRC = 'https://res.cloudinary.com/dzr18sd58/video/upload/v1781097458/Ramen_ingredients_transforming_i__202606101416_h6lyzl.mp4'

interface HeroVideoSectionProps {
  city?: string
  playVideo?: boolean
}

const textVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function HeroVideoSection({ city, playVideo = true }: HeroVideoSectionProps) {
  const reduceMotion = useReducedMotion()

  return (
    <section
      className="relative overflow-hidden bg-neutral-0 border-b border-neutral-100 px-4 pt-10 pb-8 md:pt-14 md:pb-10"
      aria-label="Search"
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO_SRC}
          autoPlay={playVideo}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/70 to-white/95" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        <motion.div
          initial={reduceMotion ? undefined : 'hidden'}
          animate="visible"
          variants={reduceMotion ? undefined : { hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
        >
          <motion.div
            variants={textVariant}
            transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
            className="text-center mb-6"
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold text-amber-500 mb-2">
              Chow Here
            </h1>
            <p className="font-display text-base md:text-lg text-neutral-600">
              Find verified Nigerian restaurants, dish by dish.
            </p>
          </motion.div>

          <motion.div
            variants={textVariant}
            transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
            className="text-center mb-6"
          >
            <p className="max-w-xl mx-auto text-sm md:text-base text-neutral-500">
              Search by dish, explore trusted reviews, and discover the best verified restaurants near you.
            </p>
          </motion.div>

          <motion.div
            variants={textVariant}
            transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.9, ease: 'easeOut' }}
            className="relative"
          >
            <div className="relative">
              <div className="hidden lg:block">
                <SearchBar heroMode placeholder="Search for a dish..." />
              </div>
              <div className="lg:hidden">
                <SearchBar heroMode placeholder="Search for a dish..." />
              </div>
            </div>
            {city && (
              <p className="text-sm text-neutral-500 text-center mt-3">
                Showing results in <span className="font-medium text-neutral-700">{city}</span>
              </p>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

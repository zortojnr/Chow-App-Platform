'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { SearchBar } from 'features/search/components/SearchBar'

interface HeroVideoSectionProps {
  city?: string
}

const textVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function HeroVideoSection({ city }: HeroVideoSectionProps) {
  const reduceMotion = useReducedMotion()

  return (
    <section
      className="relative overflow-hidden bg-neutral-0 w-full h-[60vh] md:min-h-screen flex items-center justify-center"
      aria-label="Search"
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0.78, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="https://res.cloudinary.com/dzr18sd58/video/upload/v1781097458/Ramen_ingredients_transforming_i__202606101416_h6lyzl.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/70 to-white/95" />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 w-full">
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
            <div className="mx-auto mb-4 block sm:hidden w-20 h-24">
              <Image
                src="/asset-2.webp"
                alt="Chow Here logo"
                width={96}
                height={132}
                className="w-full h-full object-contain"
                priority
              />
            </div>
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
            <SearchBar heroMode placeholder="Search for a dish..." />
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

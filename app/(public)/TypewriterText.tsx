'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface TypewriterTextProps {
  text: string
  duration?: number // total time in seconds for all characters
  delay?: number // delay before starting
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
}

export function TypewriterText({
  text,
  duration = 1.2,
  delay = 0,
  className = '',
  as: Component = 'h2',
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let animationFrameId: number | null = null

    const startTime = Date.now()
    const delayMs = delay * 1000
    const durationMs = duration * 1000

    const animate = () => {
      const elapsed = Date.now() - startTime - delayMs
      if (elapsed < 0) {
        animationFrameId = requestAnimationFrame(animate)
        return
      }

      const progress = Math.min(elapsed / durationMs, 1)
      const charCount = Math.floor(progress * text.length)
      setDisplayedText(text.substring(0, charCount))

      if (progress >= 1) {
        setIsComplete(true)
      } else {
        animationFrameId = requestAnimationFrame(animate)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [text, duration, delay])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay }}
    >
      {Component === 'h1' && <h1 className={className}>{displayedText}</h1>}
      {Component === 'h2' && <h2 className={className}>{displayedText}</h2>}
      {Component === 'h3' && <h3 className={className}>{displayedText}</h3>}
      {Component === 'p' && <p className={className}>{displayedText}</p>}
      {Component === 'span' && <span className={className}>{displayedText}</span>}
    </motion.div>
  )
}

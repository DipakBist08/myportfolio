'use client'

import { motion, useScroll, useSpring } from 'framer-motion'

/* Scroll-linked progress bar. useScroll binds to the document's scroll
   progress without a scroll listener re-rendering React on every frame; the
   spring smooths the bar so it reads as one continuous motion. */
export default function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 34, mass: 0.4 })

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary"
      style={{ scaleX }}
    />
  )
}

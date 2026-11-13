'use client'

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { isFirstLoad, markHydrated } from '@/components/motion/firstLoad'

/* Remounts on every navigation, so each route after the first arrives with
   one short rise. The first page renders in place (see firstLoad.ts), and so
   does everything under prefers-reduced-motion. */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  const animate = !reduce && !isFirstLoad()

  useEffect(() => {
    markHydrated()
  }, [])

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

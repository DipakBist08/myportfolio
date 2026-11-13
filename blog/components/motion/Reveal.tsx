'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { isFirstLoad } from './firstLoad'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

/* No entrance motion on the first page view (see firstLoad.ts) or under
   prefers-reduced-motion: the content simply renders in place. */
const stillOnMount = (reduce: boolean | null) => Boolean(reduce) || isFirstLoad()

/* One fade-and-rise on entry, once. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'header' | 'li' | 'article'
}) {
  const still = stillOnMount(useReducedMotion())
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={still ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </Tag>
  )
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

/* A list whose children rise in sequence when it enters the viewport. */
export function StaggerList({
  children,
  className,
  as = 'ul',
}: {
  children: ReactNode
  className?: string
  as?: 'ul' | 'ol' | 'div'
}) {
  const still = stillOnMount(useReducedMotion())
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      variants={still ? undefined : staggerParent}
      initial={still ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
    >
      {children}
    </Tag>
  )
}

export function StaggerItem({
  children,
  className,
  as = 'li',
}: {
  children: ReactNode
  className?: string
  as?: 'li' | 'div' | 'article'
}) {
  const still = stillOnMount(useReducedMotion())
  const Tag = motion[as]
  return (
    <Tag className={className} variants={still ? undefined : staggerChild}>
      {children}
    </Tag>
  )
}

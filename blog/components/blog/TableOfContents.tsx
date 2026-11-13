'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Heading } from '@/lib/blog/utils'

interface TableOfContentsProps {
  headings: Heading[]
}

/* Section list with a single indicator that slides between entries as the
   reader moves through the article (layoutId animates its position). */
export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? '')
  const reduce = useReducedMotion()

  useEffect(() => {
    if (headings.length === 0) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Number.POSITIVE_INFINITY))
        // The topmost heading currently inside the reading band wins.
        let best = ''
        let bestTop = Number.POSITIVE_INFINITY
        headings.forEach(({ id }) => {
          const top = visible.get(id)
          if (top !== undefined && top < bestTop) { bestTop = top; best = id }
        })
        if (best) setActiveId(best)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: [0, 1] },
    )
    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav aria-label="Table of contents">
      <p className="mono-label mb-3 uppercase tracking-[0.06em]">On this page</p>
      <ul className="relative border-l border-line">
        {headings.map((heading) => {
          const active = activeId === heading.id
          return (
            <li key={heading.id} className="relative" style={{ paddingLeft: heading.level === 3 ? '0.75rem' : '0' }}>
              {active && (
                <motion.span
                  layoutId="toc-indicator"
                  aria-hidden="true"
                  className="absolute -left-px top-0 h-full w-0.5 bg-primary"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 36 }}
                />
              )}
              <a
                href={`#${heading.id}`}
                className={`toc-link ${active ? 'active' : ''}`}
                aria-current={active ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById(heading.id)
                  if (!el) return
                  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
                  history.replaceState(null, '', `#${heading.id}`)
                  setActiveId(heading.id)
                }}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

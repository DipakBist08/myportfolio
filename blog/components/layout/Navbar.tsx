'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { useTheme } from './ThemeProvider'
import ExternalLink from './ExternalLink'

const PORTFOLIO_URL = 'https://dipakbist.com.np'

export interface NavLink {
  href: string
  label: string
  /** Other paths on which this link also shows as the current section. */
  also?: string[]
}

const isCurrent = (l: NavLink, pathname: string) => pathname === l.href || Boolean(l.also?.includes(pathname))

const Icon = ({ d, className = 'h-5 w-5' }: { d: string; className?: string }) => (
  <svg className={className} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
)

const PATHS = {
  sun: 'M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z',
  moon: 'M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z',
  list: 'M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z',
  x: 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z',
  external: 'M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z',
}

/* `links` is built in app/layout.tsx: "Articles", then the sections listed in
   NAV_SECTIONS (lib/blog/site.ts), in that order. Every section has a page,
   even before its first post, so the menu never points at a missing page. */
export default function Navbar({ links: LINKS }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { theme, toggle } = useTheme()
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8))

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const isLight = theme === 'light'

  return (
    <header
      className={`sticky top-0 z-50 h-[var(--header-height)] border-b bg-bg transition-colors duration-300 ${scrolled ? 'border-line' : 'border-transparent'}`}
    >
      <nav className="container-page flex h-full items-center justify-between gap-6" aria-label="Primary">
        <Link href="/" className="inline-flex min-h-11 items-center font-mono text-[1.05rem] font-semibold tracking-tight text-ink no-underline">
          <span className="text-primary-light">&lt;</span>Dipak.Blog<span className="text-primary-light">/&gt;</span>
        </Link>

        <div className="flex items-center gap-1">
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <NavLink href={l.href} active={isCurrent(l, pathname)}>{l.label}</NavLink>
              </li>
            ))}
            <li>
              <ExternalLink
                href={PORTFOLIO_URL}
                className="ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg border border-line-strong px-3 text-[0.9375rem] font-medium text-ink no-underline transition-colors hover:border-primary"
              >
                Portfolio <Icon d={PATHS.external} className="h-4 w-4 text-muted" />
              </ExternalLink>
            </li>
          </ul>

          <button
            type="button"
            onClick={toggle}
            aria-pressed={isLight}
            aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            className="inline-grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--ink-rgb)/0.06)] hover:text-ink"
          >
            <Icon d={isLight ? PATHS.sun : PATHS.moon} />
          </button>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--ink-rgb)/0.06)] hover:text-ink md:hidden"
          >
            <Icon d={open ? PATHS.x : PATHS.list} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            key="menu"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full border-b border-line bg-bg md:hidden"
          >
            <ul className="container-page flex flex-col gap-1 py-3">
              {LINKS.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <NavLink href={l.href} active={isCurrent(l, pathname)} block>{l.label}</NavLink>
                </motion.li>
              ))}
              <li className="mt-2 border-t border-line pt-3">
                <ExternalLink
                  href={PORTFOLIO_URL}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-1 rounded-lg border border-line-strong px-3 text-base font-medium text-ink no-underline"
                >
                  Portfolio <Icon d={PATHS.external} className="h-4 w-4 text-muted" />
                </ExternalLink>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function NavLink({ href, active, block, children }: { href: string; active: boolean; block?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center rounded-lg px-3 font-medium no-underline transition-colors ${block ? 'min-h-12 w-full text-base' : 'min-h-11 text-[0.9375rem]'} ${
        active ? 'bg-primary/10 text-ink' : 'text-muted hover:bg-[rgb(var(--ink-rgb)/0.06)] hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

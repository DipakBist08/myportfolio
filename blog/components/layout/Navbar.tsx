'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTheme } from './ThemeProvider'

const PORTFOLIO_URL = 'https://dipakbist.com'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-surface-darker/80 backdrop-blur-md light:bg-white/95 light:border-slate-200">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <Link href="/" className="font-heading text-lg font-bold tracking-tight">
          <span className="text-slate-500">&lt;</span>
          <span className="gradient-text">Dipak</span>
          <span className="text-primary">.</span>
          <span className="gradient-text">Blog</span>
          <span className="text-slate-500">/&gt;</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-1 md:flex">
          <NavLink href="/">All Posts</NavLink>
          <NavLink href="/blog/category/manual-testing">Manual QA</NavLink>
          <NavLink href="/blog/category/automation-testing">Automation</NavLink>
          <NavLink href="/blog/category/api-testing">API Testing</NavLink>
          <li>
            <a
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-primary-light light:text-slate-500 light:hover:text-primary transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Portfolio
            </a>
          </li>
        </ul>

        {/* Right: theme + hamburger */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/60 text-slate-400 hover:border-primary/50 hover:text-primary-light light:border-slate-200 light:text-slate-500 light:hover:border-primary/40 light:hover:text-primary transition-all"
          >
            {theme === 'dark' ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-700/60 light:border-slate-200 md:hidden"
          >
            <span className={`block h-0.5 w-5 bg-slate-400 light:bg-slate-500 transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 bg-slate-400 light:bg-slate-500 transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-slate-400 light:bg-slate-500 transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-800/60 bg-surface-darker px-6 py-4 light:bg-white light:border-slate-200 md:hidden">
          <ul className="flex flex-col gap-1">
            <NavLink href="/" onClick={() => setMobileOpen(false)}>All Posts</NavLink>
            <NavLink href="/blog/category/manual-testing" onClick={() => setMobileOpen(false)}>Manual QA</NavLink>
            <NavLink href="/blog/category/automation-testing" onClick={() => setMobileOpen(false)}>Automation</NavLink>
            <NavLink href="/blog/category/api-testing" onClick={() => setMobileOpen(false)}>API Testing</NavLink>
            <li className="pt-1 border-t border-slate-800/40 light:border-slate-200 mt-1">
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 py-1.5 text-sm text-slate-500 hover:text-primary-light light:hover:text-primary transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back to Portfolio
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}

function NavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="inline-block rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900 transition-all"
      >
        {children}
      </Link>
    </li>
  )
}

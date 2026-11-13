'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

const boxClass = 'flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors'

/* Real links, not buttons, so every page of the list can be crawled and
   opened in a new tab. */
export default function Pagination({ currentPage, totalPages }: PaginationProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) params.delete('page')
    else params.set('page', String(page))
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const showPages = pages.filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Pagination">
      <Arrow page={currentPage - 1} disabled={currentPage === 1} label="Previous page" href={hrefFor(currentPage - 1)}>
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </Arrow>

      {showPages.map((page, i) => {
        const prev = showPages[i - 1]
        const gap = prev && page - prev > 1

        return (
          <div key={page} className="flex items-center gap-1.5">
            {gap && <span className="px-1 text-muted">…</span>}
            <Link
              href={hrefFor(page)}
              scroll={false}
              className={`${boxClass} font-medium no-underline ${
                page === currentPage
                  ? 'border-primary bg-primary/20 text-primary-light'
                  : 'border-line text-muted hover:border-primary hover:text-ink'
              }`}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Link>
          </div>
        )
      })}

      <Arrow page={currentPage + 1} disabled={currentPage === totalPages} label="Next page" href={hrefFor(currentPage + 1)}>
        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
      </Arrow>
    </nav>
  )
}

function Arrow({
  disabled,
  label,
  href,
  children,
}: {
  page: number
  disabled: boolean
  label: string
  href: string
  children: React.ReactNode
}) {
  const icon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {children}
    </svg>
  )

  if (disabled) {
    return (
      <span className={`${boxClass} cursor-not-allowed border-line text-muted opacity-40`} aria-hidden="true">
        {icon}
      </span>
    )
  }

  return (
    <Link href={href} scroll={false} aria-label={label} className={`${boxClass} border-line text-muted no-underline hover:border-primary hover:text-ink`}>
      {icon}
    </Link>
  )
}

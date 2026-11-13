import type { ReactNode } from 'react'

/** Shared shell for the plain text pages: About, Contact, Privacy Policy, Disclaimer. */
export default function SitePage({
  title,
  intro,
  updated,
  children,
}: {
  title: string
  intro?: string
  /** ISO date, shown as "Last updated". */
  updated?: string
  children: ReactNode
}) {
  return (
    <div className="container-page pb-16 pt-10 sm:pt-14">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-[clamp(2rem,1.5rem+2vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">{title}</h1>
        {intro && <p className="mt-4 max-w-[60ch] text-lg text-muted">{intro}</p>}
        {updated && (
          <p className="mono-label mt-4">
            Last updated{' '}
            <time dateTime={updated}>
              {new Date(updated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </p>
        )}
      </header>
      <div className="prose max-w-[72ch] prose-headings:font-heading">{children}</div>
    </div>
  )
}

/** A visible notice for text that still needs the site owner's review. */
export function ReviewNotice({ children }: { children: ReactNode }) {
  return (
    <p className="not-prose mb-8 rounded-xl border border-line border-l-2 border-l-[rgb(251_191_36)] bg-[rgb(var(--ink-rgb)/0.03)] px-5 py-4 text-[0.9375rem] text-ink">
      <strong>Draft for review.</strong> {children}
    </p>
  )
}

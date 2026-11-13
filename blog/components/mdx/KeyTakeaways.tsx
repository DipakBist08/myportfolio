import type { ReactNode } from 'react'

/**
 * The "Key takeaways" box. Goes right after the intro, before the first H2.
 * Usage in MDX:
 *
 *   <KeyTakeaways>
 *   - First point.
 *   - Second point.
 *   </KeyTakeaways>
 */
export default function KeyTakeaways({ title = 'Key takeaways', children }: { title?: string; children: ReactNode }) {
  return (
    <aside
      className="key-takeaways my-8 rounded-xl border border-line border-l-2 border-l-primary bg-[rgb(var(--ink-rgb)/0.03)] px-5 py-4"
      aria-label={title}
    >
      <p className="m-0 text-sm font-semibold uppercase tracking-[0.06em] text-primary-light">{title}</p>
      <div className="mt-2 text-[0.9375rem] leading-relaxed text-ink/90 [&>ul]:my-0 [&>ul]:pl-5 [&_li]:my-1">{children}</div>
    </aside>
  )
}

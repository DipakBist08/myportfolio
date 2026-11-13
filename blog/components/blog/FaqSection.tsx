import type { FaqItem } from '@/lib/blog/types'

export const FAQ_HEADING_ID = 'frequently-asked-questions'

/**
 * Visible FAQ, rendered from the `faq` front matter so every post formats it
 * the same way. No FAQPage schema on purpose: Google no longer shows FAQ rich
 * results for sites like this, and the visible text is what readers and AI
 * search tools use.
 */
export default function FaqSection({ items }: { items?: FaqItem[] }) {
  if (!items || items.length === 0) return null

  return (
    <section className="prose mt-12 max-w-none prose-headings:font-heading" aria-labelledby={FAQ_HEADING_ID}>
      <h2 id={FAQ_HEADING_ID} className="scroll-mt-20">
        Frequently asked questions
      </h2>
      {items.map((item) => (
        <div key={item.q}>
          <h3>{item.q}</h3>
          <p>{item.a}</p>
        </div>
      ))}
    </section>
  )
}

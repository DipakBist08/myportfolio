'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RecommendationCandidate } from '@/lib/blog/utils'
import { api, compactCount } from './api'
import { ClapIcon, ResponseIcon } from './EngagementBar'

type Numbers = { claps: number; comments: number; readers: number }

const SHOWN = 4

/** How much readers' reactions add to a post's topic match. Logarithmic, so a
 *  popular post on another topic rises but a close topic match still leads:
 *  1 clap ≈ +1, 15 claps ≈ +4, 255 claps ≈ +8. A response counts as 3 claps,
 *  ten readers as one. */
export function popularity(n: Numbers): number {
  return Math.log2(1 + n.claps + 3 * n.comments + n.readers / 10)
}

export function rank(candidates: RecommendationCandidate[], numbers: Record<string, Numbers> | null) {
  const scored = candidates.map((post, order) => ({
    post,
    order,
    score: post.relevance + (numbers?.[post.slug] ? popularity(numbers[post.slug]) : 0),
  }))
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.post)
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** "Recommended from <blog>": up to four posts, closest topic first, lifted by
 *  how readers responded (claps, responses, readers from the CMS API). The
 *  server sends the topic order, so the cards are there without JavaScript;
 *  the numbers arrive when the section nears the screen. */
export default function RecommendedPosts({
  candidates,
  siteName,
  authorName,
}: {
  candidates: RecommendationCandidate[]
  siteName: string
  authorName: string
}) {
  const [numbers, setNumbers] = useState<Record<string, Numbers> | null>(null)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || candidates.length === 0) return
    let alive = true
    const load = () =>
      api<{ posts: Record<string, Numbers> }>(
        `/api/public/engagement?slugs=${encodeURIComponent(candidates.map((c) => c.slug).join(','))}`,
      )
        .then((data) => alive && setNumbers(data.posts))
        .catch(() => {})
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          load()
        }
      },
      { rootMargin: '800px 0px' },
    )
    observer.observe(el)
    return () => { alive = false; observer.disconnect() }
  }, [candidates])

  const shown = useMemo(() => rank(candidates, numbers).slice(0, SHOWN), [candidates, numbers])
  if (shown.length === 0) return null

  return (
    <section ref={ref} aria-labelledby="recommended-heading">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="recommended-heading" className="text-xl font-semibold tracking-[-0.01em] text-ink">
          Recommended from {siteName}
        </h2>
        <Link href="/" className="text-sm text-primary-light">See all articles</Link>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {shown.map((post) => {
          const n = numbers?.[post.slug]
          return (
            <li key={post.slug} className="min-w-0">
              <article className="group relative flex h-full flex-col rounded-xl border border-line bg-surface-card p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong motion-reduce:hover:translate-y-0 light:bg-white">
                <p className="flex min-w-0 items-center gap-2 text-xs text-muted">
                  <Image src="/dipak-bist.png" alt="" width={20} height={20} sizes="20px" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                  <span className="truncate">
                    <span className="text-ink">{authorName}</span> in <span className="text-primary-light">{post.category}</span>
                  </span>
                </p>
                <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-ink">
                  <Link href={`/blog/${post.slug}`} className="no-underline after:absolute after:inset-0 after:rounded-xl group-hover:text-primary-light">
                    {post.title}
                  </Link>
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{post.excerpt}</p>
                <p className="mono-label mt-auto flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 pt-4">
                  <span>
                    Posted <time dateTime={post.date}>{shortDate(post.date)}</time>
                  </span>
                  <span>{post.readingTime}</span>
                  {n && n.claps > 0 && (
                    <span className="inline-flex items-center gap-1" title={`${n.claps} clap${n.claps === 1 ? '' : 's'}`}>
                      <ClapIcon className="h-4 w-4" />
                      <span className="sr-only">Claps:</span> {compactCount(n.claps)}
                    </span>
                  )}
                  {n && n.comments > 0 && (
                    <span className="inline-flex items-center gap-1" title={`${n.comments} responses`}>
                      <ResponseIcon className="h-4 w-4" />
                      <span className="sr-only">Responses:</span> {compactCount(n.comments)}
                    </span>
                  )}
                </p>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

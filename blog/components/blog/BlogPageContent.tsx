'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { PostMeta } from '@/lib/blog/types'
import {
  getAllTags,
  getAllCategories,
  filterByTag,
  filterByCategory,
  searchPosts,
  paginatePosts,
  formatDate,
  POSTS_PER_PAGE,
} from '@/lib/blog/utils'
import BlogSearch from '@/components/blog/BlogSearch'
import TagBadge from '@/components/blog/TagBadge'
import Pagination from '@/components/blog/Pagination'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const Arrow = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
    <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z" />
  </svg>
)

interface Props {
  allPosts: PostMeta[]
}

interface ViewProps extends Props {
  q?: string
  tag?: string
  category?: string
  page?: number
}

/* Reads the filters from the URL. useSearchParams() opts this component out of
   static rendering, so app/page.tsx renders <BlogPageView> with no filters as
   the Suspense fallback: that is what ships in the server HTML, and it is the
   same markup the unfiltered page shows once this component takes over. */
export default function BlogPageContent({ allPosts }: Props) {
  const searchParams = useSearchParams()
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  return (
    <BlogPageView
      allPosts={allPosts}
      q={searchParams.get('q') ?? ''}
      tag={searchParams.get('tag') ?? ''}
      category={searchParams.get('category') ?? ''}
      page={Number.isFinite(page) && page > 0 ? page : 1}
    />
  )
}

export function BlogPageView({ allPosts, q = '', tag = '', category = '', page = 1 }: ViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const reduce = useReducedMotion()

  const allTags = useMemo(() => getAllTags(allPosts), [allPosts])
  const allCategories = useMemo(() => getAllCategories(allPosts), [allPosts])

  const filtered = useMemo(() => {
    let posts = allPosts
    if (q) posts = searchPosts(posts, q)
    if (tag) posts = filterByTag(posts, tag)
    if (category) posts = filterByCategory(posts, category)
    return posts
  }, [allPosts, q, tag, category])

  const isFiltered = Boolean(q || tag || category)
  const paginated = useMemo(() => paginatePosts(filtered, page, POSTS_PER_PAGE), [filtered, page])

  // The newest post leads when nothing is filtered; the rest follow as rows.
  const lead = !isFiltered && page === 1 ? paginated.posts[0] : null
  const rows = lead ? paginated.posts.slice(1) : paginated.posts

  const setCategory = useCallback(
    (value: string) => {
      const params = new URLSearchParams(window.location.search)
      if (value) params.set('category', value)
      else params.delete('category')
      params.delete('page')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  const clearAll = () => router.push(pathname, { scroll: false })

  return (
    <div className="container-page pb-16 pt-10 sm:pt-14">
      {/* Masthead */}
      {/* No entrance animation here: app/template.tsx already animates the route
          in, and the server-rendered fallback must look the same as this view. */}
      <header className="mb-10 max-w-3xl sm:mb-14">
        <h1
          className="text-[clamp(2.25rem,1.5rem+3vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.035em] text-ink"
        >
          Writing on software quality.
        </h1>
        <p className="mt-4 max-w-[52ch] text-lg text-muted">
          Practical articles on test automation, API testing, bug reporting, Playwright, Selenium, and building a QA career.
        </p>
        <p className="mono-label mt-5 flex flex-wrap items-center gap-x-3">
          <span>{allPosts.length} article{allPosts.length === 1 ? '' : 's'}</span>
        </p>
      </header>

      {/* Toolbar: search + category filter */}
      <div className="mb-8 flex flex-col gap-4 border-y border-line py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          <button type="button" onClick={() => setCategory('')} className={`chip ${!category ? 'is-active' : ''}`} aria-pressed={!category}>
            All
          </button>
          {allCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? '' : c)}
              className={`chip ${category === c ? 'is-active' : ''}`}
              aria-pressed={category === c}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="w-full md:w-72">
          {/* BlogSearch and Pagination read the URL themselves, so each needs its
              own boundary to stay out of the way of the server-rendered list. */}
          <Suspense fallback={null}>
            <BlogSearch />
          </Suspense>
        </div>
      </div>

      {/* Active filter summary */}
      {isFiltered && (
        <p className="mb-6 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>
            <span className="font-semibold text-ink">{paginated.total}</span> result{paginated.total === 1 ? '' : 's'}
            {q && <> for &ldquo;<span className="text-primary-light">{q}</span>&rdquo;</>}
            {tag && <> tagged <span className="text-primary-light">{tag}</span></>}
          </span>
          <button type="button" onClick={clearAll} className="text-primary-light underline underline-offset-2">
            Clear filters
          </button>
        </p>
      )}

      {/* Lead article */}
      <AnimatePresence initial={false} mode="popLayout">
        {lead && (
          <motion.article
            key={`lead-${lead.slug}`}
            layout
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.5, ease: EASE }}
            className="group mb-10 grid gap-6 rounded-2xl border border-line bg-surface-card p-5 transition-colors hover:border-line-strong sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-10 light:bg-white"
          >
            {lead.coverImage && (
              <Link href={`/blog/${lead.slug}`} className="block overflow-hidden rounded-xl border border-line" tabIndex={-1} aria-hidden="true">
                <Image
                  src={lead.coverImage}
                  alt=""
                  width={1200}
                  height={675}
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="aspect-video h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </Link>
            )}
            <div className="flex flex-col gap-4">
              <p className="mono-label flex flex-wrap items-center gap-x-2">
                <span className="text-primary-light">Latest</span>
                <span aria-hidden="true">&middot;</span>
                <span>{lead.category}</span>
                <span aria-hidden="true">&middot;</span>
                <time dateTime={lead.date}>{formatDate(lead.date)}</time>
                <span aria-hidden="true">&middot;</span>
                <span>{lead.readingTime}</span>
              </p>
              <h2 className="text-[clamp(1.5rem,1.2rem+1.4vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
                <Link href={`/blog/${lead.slug}`} className="no-underline transition-colors hover:text-primary-light">
                  {lead.title}
                </Link>
              </h2>
              <p className="max-w-[60ch] text-base leading-relaxed text-muted">{lead.excerpt}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                  {lead.tags.slice(0, 4).map((t) => (
                    <li key={t}><TagBadge tag={t} /></li>
                  ))}
                </ul>
                <Link href={`/blog/${lead.slug}`} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary-light no-underline">
                  Read article <Arrow className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.article>
        )}
      </AnimatePresence>

      {/* Article rows */}
      {rows.length > 0 ? (
        <motion.ol layout className="border-t border-line" aria-label="Articles">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((post, i) => (
              <motion.li
                key={post.slug}
                layout
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.45, delay: Math.min(i, 6) * 0.05, ease: EASE } }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                className="border-b border-line"
              >
                <PostRow post={post} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ol>
      ) : (
        !lead && (
          <div className="rounded-xl border border-line px-6 py-16 text-center">
            <p className="font-mono text-sm text-muted">expect(results).toHaveLength(&gt; 0)</p>
            <p className="mt-2 text-ink">No articles match that filter.</p>
            <button type="button" onClick={clearAll} className="btn btn-secondary mt-5">Show all articles</button>
          </div>
        )
      )}

      {paginated.totalPages > 1 && (
        <div className="mt-10">
          <Suspense fallback={null}>
            <Pagination currentPage={paginated.currentPage} totalPages={paginated.totalPages} />
          </Suspense>
        </div>
      )}

      {/* Topics */}
      {!isFiltered && allTags.length > 0 && (
        <section className="mt-16" aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="mb-4 text-xl font-semibold text-ink">Topics</h2>
          <ul className="flex flex-wrap gap-2">
            {allTags.map((t) => (
              <li key={t}><TagBadge tag={t} size="md" /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PostRow({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid gap-2 py-6 no-underline sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:gap-8 sm:py-7"
    >
      <p className="mono-label flex flex-col gap-1">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span>{post.category}</span>
        <span>{post.readingTime}</span>
      </p>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold leading-snug text-ink transition-colors group-hover:text-primary-light sm:text-[1.375rem]">
          {post.title}
        </h2>
        <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted">{post.excerpt}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {post.tags.slice(0, 3).map((t) => (
            <li key={t} className="chip min-h-7 px-2.5 text-xs">{t}</li>
          ))}
        </ul>
      </div>
      <span className="hidden self-start pt-1 text-subtle transition-[color,transform] duration-300 ease-out group-hover:translate-x-1 group-hover:text-primary-light sm:block">
        <Arrow />
      </span>
    </Link>
  )
}

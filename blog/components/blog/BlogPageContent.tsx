'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import type { PostMeta } from '@/lib/blog/types'
import {
  getFeaturedPosts,
  getAllTags,
  getAllCategories,
  filterByTag,
  filterByCategory,
  searchPosts,
  paginatePosts,
  POSTS_PER_PAGE,
} from '@/lib/blog/utils'
import BlogCard from '@/components/blog/BlogCard'
import BlogSearch from '@/components/blog/BlogSearch'
import BlogFilters from '@/components/blog/BlogFilters'
import TagBadge from '@/components/blog/TagBadge'
import Pagination from '@/components/blog/Pagination'

interface Props {
  allPosts: PostMeta[]
}

export default function BlogPageContent({ allPosts }: Props) {
  const searchParams = useSearchParams()

  const q        = searchParams.get('q') ?? ''
  const tag      = searchParams.get('tag') ?? ''
  const category = searchParams.get('category') ?? ''
  const page     = parseInt(searchParams.get('page') ?? '1', 10)
  const featured = searchParams.get('featured') === '1'

  const featured3    = useMemo(() => getFeaturedPosts(allPosts, 3), [allPosts])
  const allTags      = useMemo(() => getAllTags(allPosts), [allPosts])
  const allCategories = useMemo(() => getAllCategories(allPosts), [allPosts])

  const filtered = useMemo(() => {
    let posts = allPosts
    if (q)        posts = searchPosts(posts, q)
    if (tag)      posts = filterByTag(posts, tag)
    if (category) posts = filterByCategory(posts, category)
    if (featured) posts = posts.filter((p) => p.featured)
    return posts
  }, [allPosts, q, tag, category, featured])

  const paginated  = useMemo(() => paginatePosts(filtered, page, POSTS_PER_PAGE), [filtered, page])
  const isFiltered = !!(q || tag || category)

  const [heroPost, ...restFeatured] = featured3

  return (
    <div className="min-h-screen">
      {/* ── Hero / Header ── */}
      {!isFiltered && (
        <div className="relative overflow-hidden border-b border-slate-800/60 light:border-slate-200 bg-gradient-to-b from-slate-900 via-slate-900/95 to-transparent light:from-slate-50 light:via-slate-50/95">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_70%)]" />
          <div className="mx-auto max-w-6xl px-6 py-16 text-center relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-light light:text-primary mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-light animate-pulse" />
              QA Engineering Blog
            </span>
            <h1 className="font-heading text-4xl font-bold text-slate-100 light:text-slate-900 sm:text-5xl lg:text-6xl leading-tight">
              Software Quality{' '}
              <span className="gradient-text">Insights</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 light:text-slate-600 leading-relaxed">
              Practical articles on test automation, API testing, bug reporting,<br className="hidden sm:block" />
              Playwright, Selenium, and building a QA career.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-slate-500 light:text-slate-400">
              {['Playwright', 'Selenium', 'API Testing', 'Manual QA', 'CI/CD', 'Python'].map((t) => (
                <span key={t} className="rounded-full border border-slate-700/50 light:border-slate-200 px-3 py-1 hover:border-primary/40 hover:text-primary-light transition-colors cursor-default">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* ── Featured: Hero card + 2 side cards ── */}
        {!isFiltered && heroPost && (
          <section className="mb-12" aria-labelledby="featured-heading">
            <div className="mb-5 flex items-center gap-3">
              <h2 id="featured-heading" className="font-heading text-lg font-bold text-slate-100 light:text-slate-900">
                Featured Articles
              </h2>
              <span className="rounded-full bg-yellow-500/15 border border-yellow-500/30 px-2.5 py-0.5 text-xs font-semibold text-yellow-400 light:text-yellow-600">
                ★ Editor&apos;s Pick
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              {/* Hero featured card — spans 3 cols */}
              <div className="lg:col-span-3">
                <BlogCard post={heroPost} featured />
              </div>

              {/* Side cards — span 2 cols stacked */}
              {restFeatured.length > 0 && (
                <div className="lg:col-span-2 flex flex-col gap-5">
                  {restFeatured.map((post) => (
                    <BlogCard key={post.slug} post={post} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Main: sidebar + posts grid ── */}
        <div className="flex gap-8">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24 space-y-6">
              <BlogSearch />
              <BlogFilters categories={allCategories} tags={allTags} />

              {/* Stats strip */}
              {allPosts.length > 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-surface-card/30 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick Stats</p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-slate-800/50 light:bg-slate-100 p-2">
                      <p className="text-lg font-bold text-slate-100 light:text-slate-900">{allPosts.length}</p>
                      <p className="text-xs text-slate-500">Articles</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 light:bg-slate-100 p-2">
                      <p className="text-lg font-bold text-slate-100 light:text-slate-900">{allTags.length}</p>
                      <p className="text-xs text-slate-500">Topics</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {/* Mobile search */}
            <div className="mb-5 lg:hidden">
              <BlogSearch />
            </div>

            {isFiltered ? (
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  <span className="font-semibold text-slate-200">{paginated.total}</span> result{paginated.total !== 1 ? 's' : ''}
                  {q && <span> for &ldquo;<span className="text-primary-light">{q}</span>&rdquo;</span>}
                </p>
              </div>
            ) : (
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-slate-100 light:text-slate-900">
                  All Articles
                </h2>
                <span className="text-xs text-slate-500">{allPosts.length} posts</span>
              </div>
            )}

            {paginated.posts.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {paginated.posts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700/50 bg-surface-card/30 py-20 text-center gap-3">
                <svg className="h-10 w-10 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
                <p className="text-slate-400">No posts found.</p>
                <p className="text-xs text-slate-600">Try adjusting your search or filters.</p>
              </div>
            )}

            {paginated.totalPages > 1 && (
              <div className="mt-10">
                <Pagination currentPage={paginated.currentPage} totalPages={paginated.totalPages} />
              </div>
            )}
          </div>
        </div>

        {/* ── Browse by Topic ── */}
        {!isFiltered && allTags.length > 0 && (
          <section className="mt-16 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-surface-card/20 light:bg-white light:border-slate-200 p-6">
            <h2 className="mb-4 font-heading text-base font-bold text-slate-100 light:text-slate-900">
              Browse by Topic
            </h2>
            <div className="flex flex-wrap gap-2">
              {allTags.map((t) => (
                <TagBadge key={t} tag={t} size="md" />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}


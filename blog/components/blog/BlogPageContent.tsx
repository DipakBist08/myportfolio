'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { Suspense } from 'react'
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
  slugify,
} from '@/lib/blog/utils'
import BlogCard from '@/components/blog/BlogCard'
import BlogSearch from '@/components/blog/BlogSearch'
import BlogFilters from '@/components/blog/BlogFilters'
import TagBadge from '@/components/blog/TagBadge'
import Pagination from '@/components/blog/Pagination'

interface Props {
  allPosts: PostMeta[]
}

function Content({ allPosts }: Props) {
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {!isFiltered && (
        <div className="mb-12 text-center">
          <span className="section-tag">QA Engineering Blog</span>
          <h1 className="mt-3 font-heading text-4xl font-bold text-slate-100 light:text-slate-900 sm:text-5xl">
            Software Quality{' '}
            <span className="gradient-text">Insights</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400 light:text-slate-600">
            Practical articles on test automation, API testing, bug reporting, Playwright, Selenium, and building a QA career.
          </p>
        </div>
      )}

      {!isFiltered && featured3.length > 0 && (
        <section className="mb-14" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="mb-5 font-heading text-xl font-bold text-slate-100 light:text-slate-900">
            ★ Featured Articles
          </h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {featured3.map((post, i) => (
              <BlogCard key={post.slug} post={post} featured={i === 0} />
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 space-y-6">
            <BlogSearch />
            <BlogFilters categories={allCategories} tags={allTags} />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="mb-6 lg:hidden">
            <BlogSearch />
          </div>

          {isFiltered && (
            <div className="mb-5">
              <p className="text-sm text-slate-400">
                {paginated.total} result{paginated.total !== 1 ? 's' : ''}
                {q && <span> for &ldquo;{q}&rdquo;</span>}
              </p>
            </div>
          )}

          {!isFiltered && (
            <h2 className="mb-5 font-heading text-xl font-bold text-slate-100 light:text-slate-900">
              All Articles
            </h2>
          )}

          {paginated.posts.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {paginated.posts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700/50 bg-surface-card/30 py-16 text-center">
              <p className="text-slate-400">No posts found. Try adjusting your filters.</p>
            </div>
          )}

          {paginated.totalPages > 1 && (
            <div className="mt-10">
              <Pagination currentPage={paginated.currentPage} totalPages={paginated.totalPages} />
            </div>
          )}
        </div>
      </div>

      {!isFiltered && allTags.length > 0 && (
        <section className="mt-16 rounded-xl border border-slate-700/50 bg-surface-card/30 light:bg-white light:border-slate-200 p-6">
          <h2 className="mb-4 font-heading text-lg font-bold text-slate-100 light:text-slate-900">Browse by Topic</h2>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <TagBadge key={tag} tag={tag} size="md" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function BlogPageContent({ allPosts }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-12 text-slate-400">Loading…</div>}>
      <Content allPosts={allPosts} />
    </Suspense>
  )
}

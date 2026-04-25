import { Suspense } from 'react'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import {
  getFeaturedPosts,
  getRecentPosts,
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
import CategoryBadge from '@/components/blog/CategoryBadge'
import Pagination from '@/components/blog/Pagination'
import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Articles on Software QA, automation testing, Playwright, API testing, bug reporting, and QA career tips by Dipak Bist.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    url: BASE_URL,
    title: 'Dipak Bist | QA Engineering Blog',
    description: 'Practical articles on test automation, Playwright, API testing, bug reporting, and QA career tips.',
    siteName: 'Dipak Bist QA Blog',
  },
}

interface PageProps {
  searchParams: {
    q?: string
    tag?: string
    category?: string
    page?: string
    featured?: string
  }
}

export default async function BlogPage({ searchParams }: PageProps) {
  const allPosts = getAllPostsMeta()
  const featured = getFeaturedPosts(allPosts, 3)
  const recentPosts = getRecentPosts(allPosts, 6)
  const allTags = getAllTags(allPosts)
  const allCategories = getAllCategories(allPosts)

  // Apply filters
  let filtered = allPosts
  if (searchParams.q) filtered = searchPosts(filtered, searchParams.q)
  if (searchParams.tag) filtered = filterByTag(filtered, searchParams.tag)
  if (searchParams.category) filtered = filterByCategory(filtered, searchParams.category)
  if (searchParams.featured === '1') filtered = filtered.filter((p) => p.featured)

  const page = parseInt(searchParams.page ?? '1', 10)
  const paginated = paginatePosts(filtered, page, POSTS_PER_PAGE)

  const isFiltered = !!(searchParams.q || searchParams.tag || searchParams.category)

  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'Dipak Bist QA Blog',
    url: BASE_URL,
    description: 'Practical articles on software testing, automation, Playwright, API testing and QA career tips.',
    author: {
      '@type': 'Person',
      name: 'Dipak Bist',
      url: 'https://dipakbist.com',
      sameAs: [
        'https://www.linkedin.com/in/dipakbist08/',
        'https://github.com/dipakbist08',
        'https://twitter.com/dipakbist08',
      ],
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
    <div className="mx-auto max-w-6xl px-6 py-12">

      {/* ── Hero ─────────────────────────────────────── */}
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

      {/* ── Featured Posts ────────────────────────────── */}
      {!isFiltered && featured.length > 0 && (
        <section className="mb-14" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="mb-5 font-heading text-xl font-bold text-slate-100 light:text-slate-900">
            ★ Featured Articles
          </h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {featured.map((post, i) => (
              <BlogCard key={post.slug} post={post} featured={i === 0} />
            ))}
          </div>
        </section>
      )}

      {/* ── Main layout: Sidebar + Grid ──────────────── */}
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 space-y-6">
            <Suspense fallback={null}>
              <BlogSearch />
              <BlogFilters categories={allCategories} tags={allTags} />
            </Suspense>
          </div>
        </aside>

        {/* Posts grid */}
        <div className="flex-1 min-w-0">
          {/* Mobile search */}
          <div className="mb-6 lg:hidden">
            <Suspense fallback={null}>
              <BlogSearch />
            </Suspense>
          </div>

          {/* Results header */}
          {isFiltered && (
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {paginated.total} result{paginated.total !== 1 ? 's' : ''}
                {searchParams.q && <span> for &ldquo;{searchParams.q}&rdquo;</span>}
              </p>
            </div>
          )}

          {/* Section title when not filtered */}
          {!isFiltered && (
            <h2 className="mb-5 font-heading text-xl font-bold text-slate-100 light:text-slate-900">
              All Articles
            </h2>
          )}

          {/* Grid */}
          {paginated.posts.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {paginated.posts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700/50 bg-surface-card/30 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <svg className="h-6 w-6 text-primary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-slate-400">No posts found. Try adjusting your filters.</p>
            </div>
          )}

          {/* Pagination */}
          {paginated.totalPages > 1 && (
            <div className="mt-10">
              <Suspense fallback={null}>
                <Pagination currentPage={paginated.currentPage} totalPages={paginated.totalPages} />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {/* ── Tags cloud ───────────────────────────────── */}
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
    </>
  )
}

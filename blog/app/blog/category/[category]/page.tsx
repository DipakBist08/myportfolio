import { Metadata } from 'next'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import { filterByCategory, getAllCategories, sortPostsByDate, slugify } from '@/lib/blog/utils'
import BlogCard from '@/components/blog/BlogCard'
import CategoryBadge from '@/components/blog/CategoryBadge'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

interface Params {
  params: { category: string }
}

export async function generateStaticParams() {
  const categories = getAllCategories(getAllPostsMeta())
  return categories.map((cat) => ({ category: slugify(cat) }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const label = params.category.replace(/-/g, ' ')
  const url = `${BASE_URL}/blog/category/${params.category}`
  return {
    title: `${label} articles`,
    description: `Browse all ${label} articles on software testing, QA automation and engineering by Dipak Bist.`,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: `${label} — Dipak Bist QA Blog`,
      description: `All articles in the ${label} category.`,
      siteName: 'Dipak Bist QA Blog',
    },
  }
}

export default async function CategoryPage({ params }: Params) {
  const allPosts = getAllPostsMeta()
  const allCategories = getAllCategories(allPosts)
  const posts = sortPostsByDate(filterByCategory(allPosts, params.category))
  const categoryLabel = params.category.replace(/-/g, ' ')
  const categoryUrl = `${BASE_URL}/blog/category/${params.category}`

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': categoryUrl,
    name: `${categoryLabel} articles`,
    description: `All articles in the ${categoryLabel} category on Dipak Bist QA Blog.`,
    url: categoryUrl,
    author: { '@type': 'Person', name: 'Dipak Bist', url: 'https://dipakbist.com' },
    hasPart: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${BASE_URL}/blog/${p.slug}`,
      datePublished: p.date,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <Link href="/" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-light transition-colors">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All Posts
        </Link>
        <span className="section-tag">Category</span>
        <h1 className="mt-2 font-heading text-3xl font-bold capitalize text-slate-100 light:text-slate-900">
          {categoryLabel}
        </h1>
        <p className="mt-1 text-slate-400 light:text-slate-600">
          {posts.length} article{posts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Posts */}
      {posts.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-slate-400">No posts found in this category.</p>
      )}

      {/* Other categories */}
      <section className="mt-14 border-t border-slate-700/30 pt-8 light:border-slate-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Other Categories</h2>
        <div className="flex flex-wrap gap-2">
          {allCategories
            .filter((c) => slugify(c) !== params.category)
            .map((c) => (
              <CategoryBadge key={c} category={c} />
            ))}
        </div>
      </section>
    </div>
    </>
  )
}

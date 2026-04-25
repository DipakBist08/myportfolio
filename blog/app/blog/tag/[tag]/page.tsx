import { Metadata } from 'next'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import { filterByTag, getAllTags, sortPostsByDate, slugify } from '@/lib/blog/utils'
import BlogCard from '@/components/blog/BlogCard'
import TagBadge from '@/components/blog/TagBadge'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

interface Params {
  params: { tag: string }
}

export async function generateStaticParams() {
  const tags = getAllTags(getAllPostsMeta())
  return tags.map((tag) => ({ tag: slugify(tag) }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const url = `${BASE_URL}/blog/tag/${params.tag}`
  return {
    title: `#${params.tag} articles`,
    description: `Browse all articles tagged with #${params.tag} — software testing, automation and QA insights by Dipak Bist.`,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: `#${params.tag} — Dipak Bist QA Blog`,
      description: `All articles tagged #${params.tag}.`,
      siteName: 'Dipak Bist QA Blog',
    },
  }
}

export default async function TagPage({ params }: Params) {
  const allPosts = getAllPostsMeta()
  const allTags = getAllTags(allPosts)
  const posts = sortPostsByDate(filterByTag(allPosts, params.tag))
  const tagUrl = `${BASE_URL}/blog/tag/${params.tag}`

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': tagUrl,
    name: `#${params.tag} articles`,
    description: `All articles tagged #${params.tag} on Dipak Bist QA Blog.`,
    url: tagUrl,
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
        <div className="flex items-center gap-3">
          <span className="section-tag">Tag</span>
        </div>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-100 light:text-slate-900">
          #{params.tag}
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
        <p className="text-slate-400">No posts found for this tag.</p>
      )}

      {/* Other tags */}
      <section className="mt-14 border-t border-slate-700/30 pt-8 light:border-slate-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Other Tags</h2>
        <div className="flex flex-wrap gap-2">
          {allTags
            .filter((t) => slugify(t) !== params.tag)
            .map((t) => (
              <TagBadge key={t} tag={t} size="md" />
            ))}
        </div>
      </section>
    </div>
    </>
  )
}

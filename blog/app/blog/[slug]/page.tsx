import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllSlugs, getPostBySlug, getAllPostsMeta } from '@/lib/blog/mdx'
import { getRelatedPosts, getAdjacentPosts, formatDate, slugify } from '@/lib/blog/utils'
import MDXContent from '@/components/mdx/MDXContent'
import TableOfContents from '@/components/blog/TableOfContents'
import { extractHeadings } from '@/lib/blog/utils'
import RelatedPosts from '@/components/blog/RelatedPosts'
import PostNavigation from '@/components/blog/PostNavigation'
import ShareButtons from '@/components/blog/ShareButtons'
import NewsletterForm from '@/components/blog/NewsletterForm'
import CommentSection from '@/components/blog/CommentSection'
import ReadingProgress from '@/components/blog/ReadingProgress'
import TagBadge from '@/components/blog/TagBadge'
import CategoryBadge from '@/components/blog/CategoryBadge'
import Image from 'next/image'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

interface Params {
  params: { slug: string }
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = getPostBySlug(params.slug)
  if (!result) return {}

  const { meta } = result
  const ogImage = meta.coverImage ?? `${BASE_URL}/og-default.png`

  return {
    title: meta.title,
    description: meta.description || meta.excerpt,
    keywords: meta.keywords ?? meta.tags,
    authors: [{ name: meta.author }],
    openGraph: {
      type: 'article',
      title: meta.title,
      description: meta.description || meta.excerpt,
      url: `${BASE_URL}/blog/${meta.slug}`,
      publishedTime: meta.date,
      modifiedTime: meta.updatedAt,
      authors: [meta.author],
      tags: meta.tags,
      images: [{ url: ogImage, width: 1200, height: 630, alt: meta.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description || meta.excerpt,
      images: [ogImage],
    },
    alternates: {
      canonical: `${BASE_URL}/blog/${meta.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: Params) {
  const result = getPostBySlug(params.slug)
  if (!result) notFound()

  const { meta, content } = result
  const allPosts = getAllPostsMeta()
  const related = getRelatedPosts(meta, allPosts)
  const { prev, next } = getAdjacentPosts(meta.slug, allPosts)
  const headings = extractHeadings(content)

  const postUrl = `${BASE_URL}/blog/${meta.slug}`
  const authorSameAs = [
    'https://www.linkedin.com/in/dipakbist08/',
    'https://github.com/dipakbist08',
    'https://twitter.com/dipakbist08',
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': postUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    headline: meta.title,
    description: meta.description || meta.excerpt,
    datePublished: meta.date,
    dateModified: meta.updatedAt ?? meta.date,
    inLanguage: 'en-US',
    articleSection: meta.category,
    keywords: meta.keywords?.join(', ') ?? meta.tags.join(', '),
    url: postUrl,
    image: meta.coverImage
      ? { '@type': 'ImageObject', url: meta.coverImage, width: 1200, height: 630 }
      : `${BASE_URL}/og-default.png`,
    author: {
      '@type': 'Person',
      name: meta.author,
      url: 'https://dipakbist.com',
      sameAs: authorSameAs,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Dipak Bist QA Blog',
      url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/og-default.png`, width: 1200, height: 630 },
    },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: meta.category, item: `${BASE_URL}/blog/category/${slugify(meta.category)}` },
      { '@type': 'ListItem', position: 3, name: meta.title, item: postUrl },
    ],
  }

  return (
    <>
      {/* Reading progress */}
      <ReadingProgress />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex gap-10">
          {/* ── Article ──────────────────────────────── */}
          <article className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <nav className="mb-6 flex items-center gap-2 text-xs text-slate-500" aria-label="Breadcrumb">
              <a href="/" className="hover:text-primary-light transition-colors">Blog</a>
              <span>/</span>
              <CategoryBadge category={meta.category} />
            </nav>

            {/* Header */}
            <header className="mb-8">
              {/* Meta row */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                {meta.difficulty && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize
                    ${meta.difficulty === 'beginner' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                      meta.difficulty === 'intermediate' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
                      'border-red-500/30 bg-red-500/10 text-red-400'}`}
                  >
                    {meta.difficulty}
                  </span>
                )}
                {meta.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs text-yellow-400">
                    ★ Featured
                  </span>
                )}
              </div>

              <h1 className="font-heading text-3xl font-bold leading-snug text-slate-100 light:text-slate-900 sm:text-4xl">
                {meta.title}
              </h1>

              {meta.excerpt && (
                <p className="mt-3 text-lg text-slate-400 leading-relaxed light:text-slate-600">
                  {meta.excerpt}
                </p>
              )}

              {/* Author + date row */}
              <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-slate-700/30 py-4 text-sm text-slate-400 light:border-slate-200 light:text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-white">
                    {meta.author.charAt(0)}
                  </div>
                  <span>{meta.author}</span>
                </div>
                <span>·</span>
                <time dateTime={meta.date}>{formatDate(meta.date)}</time>
                {meta.updatedAt && meta.updatedAt !== meta.date && (
                  <>
                    <span>·</span>
                    <span className="text-xs">Updated {formatDate(meta.updatedAt)}</span>
                  </>
                )}
                <span>·</span>
                <span>{meta.readingTime}</span>
              </div>

              {/* Tags */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {meta.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
            </header>

            {/* Cover image */}
            {meta.coverImage && (
              <div className="mb-8 overflow-hidden rounded-xl border border-slate-700/50">
                <Image
                  src={meta.coverImage}
                  alt={meta.title}
                  width={1200}
                  height={630}
                  className="w-full object-cover"
                  priority
                />
              </div>
            )}

            {/* MDX Content */}
            <MDXContent source={content} />

            {/* Share */}
            <div className="mt-10 border-t border-slate-700/30 pt-6 light:border-slate-200">
              <ShareButtons title={meta.title} />
            </div>

            {/* Post navigation */}
            <div className="mt-8">
              <PostNavigation prev={prev} next={next} />
            </div>

            {/* Related posts */}
            {related.length > 0 && (
              <div className="mt-12 border-t border-slate-700/30 pt-8 light:border-slate-200">
                <RelatedPosts posts={related} />
              </div>
            )}

            {/* Tools used */}
            {meta.tools && meta.tools.length > 0 && (
              <div className="mt-8 rounded-xl border border-slate-700/50 bg-surface-card/30 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Tools Covered</p>
                <div className="flex flex-wrap gap-2">
                  {meta.tools.map((tool) => (
                    <span key={tool} className="rounded-md border border-secondary/20 bg-secondary/10 px-2.5 py-0.5 text-xs text-secondary">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Newsletter */}
            <NewsletterForm />

            {/* Comments */}
            <CommentSection postSlug={meta.slug} />
          </article>

          {/* ── Sidebar TOC ──────────────────────────── */}
          {headings.length > 0 && (
            <aside className="hidden w-56 shrink-0 xl:block">
              <div className="sticky top-24">
                <TableOfContents headings={headings} />
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  )
}

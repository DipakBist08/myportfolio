import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getAllSlugs, getPostBySlug, getAllPostsMeta } from '@/lib/blog/mdx'
import type { PostMeta } from '@/lib/blog/types'
import { getRelatedPosts, getAdjacentPosts, formatDate, slugify, extractHeadings } from '@/lib/blog/utils'
import { AUTHOR, AUTHOR_LD, BASE_URL, SITE_LANGUAGE, SITE_NAME, postOgImage, postUrl } from '@/lib/blog/site'
import MDXContent from '@/components/mdx/MDXContent'
import TableOfContents from '@/components/blog/TableOfContents'
import RelatedPosts from '@/components/blog/RelatedPosts'
import PostNavigation from '@/components/blog/PostNavigation'
import ShareButtons from '@/components/blog/ShareButtons'
import ShareLinks from '@/components/blog/ShareLinks'
import NewsletterForm from '@/components/blog/NewsletterForm'
import CommentSection from '@/components/blog/CommentSection'
import ReadingProgress from '@/components/blog/ReadingProgress'
import TagBadge from '@/components/blog/TagBadge'
import FaqSection, { FAQ_HEADING_ID } from '@/components/blog/FaqSection'
import AuthorBox from '@/components/blog/AuthorBox'
import ExternalLink from '@/components/layout/ExternalLink'
import AdSlot from '@/components/ads/AdSlot'
import AdSenseScript from '@/components/ads/AdSenseScript'
import { Reveal } from '@/components/motion/Reveal'

interface Params {
  params: { slug: string }
}

/** For the JSON-LD keywords (no meta keywords tag: Google ignores it). Explicit
 *  keywords win; otherwise the post's target queries; otherwise its tags. */
function postKeywords(meta: PostMeta): string[] {
  if (meta.keywords?.length) return meta.keywords
  if (meta.primaryQuery) return [meta.primaryQuery, ...(meta.secondaryQueries ?? [])]
  return meta.tags
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

// A slug that is not a visible post is a 404, never an on-demand render.
export const dynamicParams = false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = getPostBySlug(params.slug)
  if (!result) return {}

  const { meta } = result
  const title = meta.title
  const description = meta.description || meta.excerpt
  const url = postUrl(meta.slug)
  const image = { url: postOgImage(meta.slug), width: 1200, height: 630, alt: meta.title }

  return {
    title,
    description,
    authors: [{ name: meta.author, url: AUTHOR.url }],
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: SITE_NAME,
      publishedTime: meta.date,
      modifiedTime: meta.updatedAt ?? meta.date,
      authors: [AUTHOR.url],
      tags: meta.tags,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
    alternates: { canonical: url },
    // Drafts only render in previews (SHOW_DRAFTS); keep them out of any index.
    ...(meta.draft ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function BlogPostPage({ params }: Params) {
  const result = getPostBySlug(params.slug)
  if (!result) notFound()

  const { meta, content } = result
  const allPosts = getAllPostsMeta()
  const related = getRelatedPosts(meta, allPosts)
  const { prev, next } = getAdjacentPosts(meta.slug, allPosts)
  // Section-level headings only: h3s inside templates read as noise in a contents list.
  const headings = extractHeadings(content).filter((h) => h.level === 2)
  if (meta.faq?.length) headings.push({ id: FAQ_HEADING_ID, text: 'Frequently asked questions', level: 2 })

  const url = postUrl(meta.slug)
  const categoryUrl = `${BASE_URL}/blog/category/${slugify(meta.category)}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: meta.title,
    description: meta.description || meta.excerpt,
    datePublished: meta.date,
    dateModified: meta.updatedAt ?? meta.date,
    inLanguage: SITE_LANGUAGE,
    articleSection: meta.category,
    keywords: postKeywords(meta).join(', '),
    url,
    image: { '@type': 'ImageObject', url: postOgImage(meta.slug), width: 1200, height: 630 },
    author: AUTHOR_LD,
    publisher: AUTHOR_LD,
    isPartOf: { '@type': 'Blog', '@id': `${BASE_URL}/#blog`, name: SITE_NAME, url: BASE_URL },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: meta.category, item: categoryUrl },
      { '@type': 'ListItem', position: 3, name: meta.title, item: url },
    ],
  }

  return (
    <>
      <ReadingProgress />
      <AdSenseScript />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="container-page py-10 lg:py-14">
        <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_15rem]">
          <article className="min-w-0 xl:max-w-[76ch]">
            <Reveal as="header" className="mb-10">
              <nav className="mono-label mb-6 flex flex-wrap items-center gap-x-2" aria-label="Breadcrumb">
                <Link href="/" className="text-muted no-underline hover:text-ink">Blog</Link>
                <span aria-hidden="true">/</span>
                <Link href={`/blog/category/${slugify(meta.category)}`} className="text-primary-light no-underline hover:underline">
                  {meta.category}
                </Link>
              </nav>

              {meta.draft && (
                <p className="mono-label mb-4 inline-block rounded border border-line px-2 py-1 text-warn">
                  Draft: not published, not indexed
                </p>
              )}

              <h1 className="text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
                {meta.title}
              </h1>

              {meta.excerpt && (
                <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">{meta.excerpt}</p>
              )}

              <p className="mono-label mt-6 flex flex-wrap items-center gap-x-2 border-y border-line py-3">
                <span>
                  By{' '}
                  <ExternalLink href={AUTHOR.url} rel="author" className="text-ink no-underline hover:text-primary-light">
                    {AUTHOR.name}
                  </ExternalLink>
                  , {AUTHOR.jobTitle}
                </span>
                <span aria-hidden="true">&middot;</span>
                <time dateTime={meta.date}>{formatDate(meta.date)}</time>
                {meta.updatedAt && meta.updatedAt !== meta.date && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span>
                      Updated <time dateTime={meta.updatedAt}>{formatDate(meta.updatedAt)}</time>
                    </span>
                  </>
                )}
                <span aria-hidden="true">&middot;</span>
                <span>{meta.readingTime}</span>
                {meta.difficulty && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span className="capitalize">{meta.difficulty}</span>
                  </>
                )}
              </p>

              {meta.testedWith && (
                <p className="mono-label mt-3">
                  <span className="text-ink">Tested with:</span> {meta.testedWith}
                </p>
              )}

              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
                {meta.tags.map((tag) => (
                  <li key={tag}><TagBadge tag={tag} /></li>
                ))}
              </ul>

              <div className="mt-4">
                <ShareLinks title={meta.title} url={url} text={meta.description || meta.excerpt} label="Share" />
              </div>
            </Reveal>

            {meta.coverImage && (
              <Reveal as="div" delay={0.1} className="mb-10 overflow-hidden rounded-xl border border-line">
                <Image
                  src={meta.coverImage}
                  alt=""
                  width={1200}
                  height={630}
                  sizes="(min-width: 1280px) 76ch, 100vw"
                  className="h-auto w-full object-cover"
                  priority
                />
              </Reveal>
            )}

            <MDXContent source={content} />

            <FaqSection items={meta.faq} />

            {/* Ad position 3 of 3: after the article and FAQ, before the author box. */}
            <AdSlot position="end-of-article" />

            <AuthorBox />

            <div className="mt-10 border-t border-line pt-6">
              <ShareButtons title={meta.title} url={url} text={meta.description || meta.excerpt} label="Share this article" />
            </div>

            <div className="mt-8">
              <PostNavigation prev={prev} next={next} />
            </div>

            {related.length > 0 && (
              <div className="mt-12 border-t border-line pt-8">
                <RelatedPosts posts={related} />
              </div>
            )}

            {meta.tools && meta.tools.length > 0 && (
              <div className="mt-8 rounded-xl border border-line p-5">
                <p className="mono-label mb-3 uppercase tracking-[0.06em]">Tools covered</p>
                <ul className="flex flex-wrap gap-1.5">
                  {meta.tools.map((tool) => (
                    <li key={tool} className="chip min-h-7 px-2.5 text-xs">{tool}</li>
                  ))}
                </ul>
              </div>
            )}

            <NewsletterForm />
            <CommentSection postSlug={meta.slug} postTitle={meta.title} />
          </article>

          {headings.length > 0 && (
            <aside className="hidden xl:block">
              <div className="sticky top-[calc(var(--header-height)+2rem)]">
                <TableOfContents headings={headings} />
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  )
}

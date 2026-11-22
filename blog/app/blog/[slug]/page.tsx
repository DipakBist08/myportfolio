import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getAllSlugs, getPostBySlug, getAllPostsMeta } from '@/lib/blog/mdx'
import type { PostMeta } from '@/lib/blog/types'
import { getRecommendationCandidates, getAdjacentPosts, formatDate, slugify, extractHeadings } from '@/lib/blog/utils'
import { AUTHOR, AUTHOR_LD, BASE_URL, HOME_URL, SITE_LANGUAGE, SITE_NAME, X_HANDLE, postOgImage, postUrl } from '@/lib/blog/site'
import MDXContent from '@/components/mdx/MDXContent'
import TableOfContents from '@/components/blog/TableOfContents'
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
import { ReaderProvider } from '@/components/blog/engagement/ReaderContext'
import { PostEngagementProvider } from '@/components/blog/engagement/PostEngagement'
import EngagementBar from '@/components/blog/engagement/EngagementBar'
import { AuthorAside, FollowOnLinkedIn } from '@/components/blog/engagement/FollowOnLinkedIn'
import RecommendedPosts from '@/components/blog/engagement/RecommendedPosts'

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
      site: X_HANDLE,
      creator: X_HANDLE,
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
  const recommended = getRecommendationCandidates(meta, allPosts)
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
    ...(meta.articleType ? { genre: meta.articleType } : {}),
    keywords: postKeywords(meta).join(', '),
    url,
    image: { '@type': 'ImageObject', url: postOgImage(meta.slug), width: 1200, height: 630 },
    author: AUTHOR_LD,
    publisher: AUTHOR_LD,
    isPartOf: { '@type': 'Blog', '@id': `${BASE_URL}/#blog`, name: SITE_NAME, url: HOME_URL },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: HOME_URL },
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

      <ReaderProvider>
      <PostEngagementProvider slug={meta.slug}>
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

              {/* Author row, Medium-style: who wrote it, a one-click LinkedIn follow, when it was posted. */}
              <div className="mt-7 flex items-start gap-3">
                <Image
                  src="/dipak-bist.png"
                  alt=""
                  width={44}
                  height={44}
                  sizes="44px"
                  priority
                  className="h-11 w-11 shrink-0 rounded-full border border-line object-cover"
                />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-semibold text-ink">
                      <ExternalLink href={AUTHOR.url} rel="author" className="text-ink no-underline hover:text-primary-light">
                        {AUTHOR.name}
                      </ExternalLink>
                      <span className="font-normal text-muted">, {AUTHOR.jobTitle}</span>
                    </span>
                    <FollowOnLinkedIn size="sm" />
                  </p>
                  <p className="mono-label mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {meta.articleType && (
                      <>
                        <span className="text-ink">{meta.articleType}</span>
                        <span aria-hidden="true">&middot;</span>
                      </>
                    )}
                    <span>
                      Posted on <time dateTime={meta.date}>{formatDate(meta.date)}</time>
                    </span>
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
                </div>
              </div>

              {/* Clap, responses, share: the same bar returns after the article. */}
              <div className="mt-6 border-y border-line py-1.5">
                <EngagementBar>
                  <ShareLinks title={meta.title} url={url} text={meta.description || meta.excerpt} />
                </EngagementBar>
              </div>

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

            {/* Ad position 3 of 3: after the article and FAQ, before the clap bar and author box. */}
            <AdSlot position="end-of-article" />

            <div className="mt-10 border-y border-line py-3">
              <EngagementBar size="lg">
                <ShareButtons title={meta.title} url={url} text={meta.description || meta.excerpt} label="Share" />
              </EngagementBar>
            </div>

            <AuthorBox />

            <div className="mt-12 border-t border-line pt-8">
              <CommentSection postSlug={meta.slug} postTitle={meta.title} />
            </div>

            <div className="mt-12">
              <PostNavigation prev={prev} next={next} />
            </div>

            {recommended.length > 0 && (
              <div className="mt-12 border-t border-line pt-8">
                <RecommendedPosts candidates={recommended} siteName={SITE_NAME} authorName={AUTHOR.name} />
              </div>
            )}

            <NewsletterForm />
          </article>

          {/* Wide screens: author + LinkedIn follow, then the contents, beside the article. */}
          <aside className="hidden xl:block">
            <div className="sticky top-[calc(var(--header-height)+2rem)] max-h-[calc(100vh-var(--header-height)-3rem)] space-y-8 overflow-y-auto pb-4">
              <AuthorAside />
              {headings.length > 0 && <TableOfContents headings={headings} />}
            </div>
          </aside>
        </div>
      </div>
      </PostEngagementProvider>
      </ReaderProvider>
    </>
  )
}

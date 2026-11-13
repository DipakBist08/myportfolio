import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import { getAllTags, sortPostsByDate, slugify } from '@/lib/blog/utils'
import { AUTHOR_LD, BASE_URL, SITE_NAME } from '@/lib/blog/site'
import BlogCard from '@/components/blog/BlogCard'
import TagBadge from '@/components/blog/TagBadge'
import { Reveal, StaggerItem, StaggerList } from '@/components/motion/Reveal'


interface Params {
  params: { tag: string }
}

export async function generateStaticParams() {
  const tags = getAllTags(getAllPostsMeta())
  return tags.map((tag) => ({ tag: slugify(tag) }))
}

export const dynamicParams = false

const MIN_POSTS_TO_INDEX = 3 // same threshold as app/sitemap.ts

function resolveTag(slug: string) {
  const allPosts = getAllPostsMeta()
  const allTags = getAllTags(allPosts)
  const label = allTags.find((t) => slugify(t) === slug)
  const posts = sortPostsByDate(allPosts.filter((p) => p.tags.some((t) => slugify(t) === slug)))
  return { allTags, label, posts }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { label, posts } = resolveTag(params.tag)
  if (!label) return {}
  const url = `${BASE_URL}/blog/tag/${params.tag}`
  return {
    title: `Articles tagged ${label}`,
    description: `Articles tagged ${label} on the ${SITE_NAME}.`,
    alternates: { canonical: url },
    // A tag with fewer than 3 posts is a thin page that repeats the category
    // hubs: it stays usable and its links are followed, but it is kept out of
    // the index and the sitemap (app/sitemap.ts uses the same threshold).
    ...(posts.length < MIN_POSTS_TO_INDEX ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function TagPage({ params }: Params) {
  const { allTags, label, posts } = resolveTag(params.tag)
  if (!label) notFound()
  const tagLabel = label
  const tagUrl = `${BASE_URL}/blog/tag/${params.tag}`

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': tagUrl,
    name: `Articles tagged ${tagLabel}`,
    description: `All articles tagged ${tagLabel} on the ${SITE_NAME}.`,
    url: tagUrl,
    author: AUTHOR_LD,
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
      <div className="container-page pb-16 pt-10 sm:pt-14">
        <Reveal as="header" className="mb-10">
          <Link href="/" className="mono-label inline-flex min-h-11 items-center gap-1 text-muted no-underline hover:text-ink">
            &larr; All articles
          </Link>
          <h1 className="mt-2 text-[clamp(2rem,1.5rem+2vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
            {tagLabel}
          </h1>
          <p className="mt-3 text-muted">
            {posts.length} article{posts.length !== 1 ? 's' : ''} with this tag
          </p>
        </Reveal>

        {posts.length > 0 ? (
          <StaggerList className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <StaggerItem key={post.slug}><BlogCard post={post} /></StaggerItem>
            ))}
          </StaggerList>
        ) : (
          <p className="text-muted">No posts found for this tag.</p>
        )}

        <section className="mt-16 border-t border-line pt-8">
          <h2 className="mono-label mb-4 uppercase tracking-[0.06em]">Other tags</h2>
          <ul className="flex flex-wrap gap-2">
            {allTags
              .filter((t) => slugify(t) !== params.tag)
              .map((t) => (
                <li key={t}><TagBadge tag={t} size="md" /></li>
              ))}
          </ul>
        </section>
      </div>
    </>
  )
}

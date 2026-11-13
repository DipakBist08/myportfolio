import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import { getHubs, hubIsIndexable, hubPosts, sortPostsByDate, slugify } from '@/lib/blog/utils'
import { AUTHOR_LD, BASE_URL, SITE_NAME } from '@/lib/blog/site'
import { CLUSTERS } from '@/lib/blog/clusters'
import BlogCard from '@/components/blog/BlogCard'
import CategoryBadge from '@/components/blog/CategoryBadge'
import { Reveal, StaggerItem, StaggerList } from '@/components/motion/Reveal'


interface Params {
  params: { category: string }
}

export async function generateStaticParams() {
  return getHubs(getAllPostsMeta()).map((hub) => ({ category: hub.slug }))
}

// A hub is a menu section (lib/blog/site.ts) or a category with a post; any
// other slug is a 404, not an empty page. A section with no published posts
// yet shows its intro and stays out of search (noindex, not in the sitemap).
export const dynamicParams = false

function resolveCategory(slug: string) {
  const allPosts = getAllPostsMeta()
  const hubs = getHubs(allPosts)
  const hub = hubs.find((h) => h.slug === slug)
  const posts = hub ? sortPostsByDate(hubPosts(hub, allPosts)) : []
  // A single category's intro comes from its cluster; a section's from site.ts.
  const cluster = hub && hub.categories.length === 1 ? CLUSTERS.find((c) => c.category === hub.categories[0]) : undefined
  return { hubs, hub, label: hub?.label, posts, cluster, intro: cluster?.intro ?? hub?.intro }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { hub, label, posts, intro } = resolveCategory(params.category)
  if (!hub || !label) return {}
  const url = `${BASE_URL}/blog/category/${params.category}`
  const description =
    intro ?? `Every ${label} article on the blog: practical, tested guides for QA engineers by Dipak Bist, Software QA Engineer.`
  return {
    title: `${label} Articles`,
    description,
    alternates: { canonical: url },
    // Empty sections, and a grouping section that still duplicates one
    // category hub, are not worth indexing (see hubIsIndexable).
    ...(!hubIsIndexable(hub, posts) && { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website',
      url,
      title: `${label} Articles`,
      description,
      siteName: SITE_NAME,
      images: [{ url: `${BASE_URL}/og-default.png`, width: 1200, height: 630, alt: SITE_NAME }],
    },
  }
}

export default async function CategoryPage({ params }: Params) {
  const { hubs, label, posts, cluster, intro } = resolveCategory(params.category)
  if (!label) notFound()
  const allCategories = hubs.map((h) => h.label)
  const categoryLabel = label
  // A category that is a cluster hub lists its pillar first.
  if (cluster) posts.sort((a, b) => Number(b.slug === cluster.pillarSlug) - Number(a.slug === cluster.pillarSlug))
  const categoryUrl = `${BASE_URL}/blog/category/${params.category}`

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': categoryUrl,
    name: `${categoryLabel} articles`,
    description: `All articles in the ${categoryLabel} category on Dipak Bist QA Blog.`,
    url: categoryUrl,
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
      {posts.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      )}
      <div className="container-page pb-16 pt-10 sm:pt-14">
        <Reveal as="header" className="mb-10">
          <Link href="/" className="mono-label inline-flex min-h-11 items-center gap-1 text-muted no-underline hover:text-ink">
            &larr; All articles
          </Link>
          <h1 className="mt-2 text-[clamp(2rem,1.5rem+2vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
            {categoryLabel}
          </h1>
          {intro && <p className="mt-4 max-w-[62ch] text-lg text-muted">{intro}</p>}
          {posts.length > 0 && (
            <p className="mono-label mt-3">
              {posts.length} article{posts.length !== 1 ? 's' : ''}
            </p>
          )}
        </Reveal>

        {posts.length > 0 ? (
          <StaggerList className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <StaggerItem key={post.slug}><BlogCard post={post} /></StaggerItem>
            ))}
          </StaggerList>
        ) : (
          <p className="text-muted">No {categoryLabel} articles yet. New ones will appear here as they are published.</p>
        )}

        <section className="mt-16 border-t border-line pt-8">
          <h2 className="mono-label mb-4 uppercase tracking-[0.06em]">Other categories</h2>
          <ul className="flex flex-wrap gap-2">
            {allCategories
              .filter((c) => slugify(c) !== params.category)
              .map((c) => (
                <li key={c}><CategoryBadge category={c} /></li>
              ))}
          </ul>
        </section>
      </div>
    </>
  )
}

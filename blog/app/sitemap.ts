import { MetadataRoute } from 'next'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import { getAllTags, getHubs, hubIsIndexable, hubPosts, slugify } from '@/lib/blog/utils'
import { BASE_URL, HOME_URL } from '@/lib/blog/site'
import { SITE_PAGES } from '@/lib/blog/pages'

/* Tags with fewer posts than this are noindex (see app/blog/tag/[tag]/page.tsx). */
const MIN_POSTS_TO_INDEX_TAG = 3

/* Only pages worth indexing: the home page, published posts, category hubs,
   tag pages with enough posts, and the site pages. lastModified is always a
   real content date (front matter, or lib/blog/pages.ts), never the build time. */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPostsMeta().filter((p) => !p.draft)
  const lastChanged = (p: { date: string; updatedAt?: string }) => new Date(p.updatedAt ?? p.date)
  const newest = (list: typeof posts) =>
    list.length ? new Date(Math.max(...list.map((p) => lastChanged(p).getTime()))) : undefined

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: lastChanged(post),
  }))

  // Hubs worth indexing: the same rule as the noindex on the hub page itself.
  const categoryEntries: MetadataRoute.Sitemap = getHubs(posts)
    .map((hub) => ({ hub, listed: hubPosts(hub, posts) }))
    .filter(({ hub, listed }) => hubIsIndexable(hub, listed))
    .map(({ hub, listed }) => ({ url: `${BASE_URL}/blog/category/${hub.slug}`, lastModified: newest(listed) }))

  const tagEntries: MetadataRoute.Sitemap = getAllTags(posts)
    .map((tag) => ({ tag, tagged: posts.filter((p) => p.tags.includes(tag)) }))
    .filter(({ tagged }) => tagged.length >= MIN_POSTS_TO_INDEX_TAG)
    .map(({ tag, tagged }) => ({ url: `${BASE_URL}/blog/tag/${slugify(tag)}`, lastModified: newest(tagged) }))

  // The plain pages, with the date their text last changed (lib/blog/pages.ts).
  const pageEntries: MetadataRoute.Sitemap = Object.values(SITE_PAGES).map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: new Date(page.updated),
  }))

  return [{ url: HOME_URL, lastModified: newest(posts) }, ...postEntries, ...categoryEntries, ...tagEntries, ...pageEntries]
}

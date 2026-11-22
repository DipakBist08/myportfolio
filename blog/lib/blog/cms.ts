/**
 * Posts written in the CMS (cms.dipakbist.com.np), read from its public API.
 *
 * GET /api/public/blog/posts         published posts (no body) + imported_slugs
 * GET /api/public/blog/posts/{slug}  one published post with its body
 *
 * Pages that use these refresh at most every CMS_REVALIDATE seconds, so a post
 * published in the CMS appears on the blog within about a minute, no redeploy.
 *
 * Failure policy (details at offline() below): an unreachable API never empties
 * the blog. A build falls back to the files; on the live site a failed refresh
 * keeps the last good page. CMS_POSTS=off: the CMS is not asked at all.
 */
import { cache } from 'react'
import { AUTHOR } from './site'
import type { ArticleType, Category, Difficulty, FaqItem, PostMeta } from './types'
import { ARTICLE_TYPES } from './types'

const API_URL = (process.env.CMS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.dipakbist.com.np').replace(/\/+$/, '')

export const CMS_ENABLED = process.env.CMS_POSTS !== 'off'

/** Seconds a page built from CMS data is reused before it is refreshed in the background. */
export const CMS_REVALIDATE = 60

interface CmsTerm {
  name: string
  slug: string
}

interface CmsPost {
  slug: string
  title: string
  excerpt: string
  seo_title: string
  seo_description: string
  featured_image: string
  featured_image_alt: string
  is_featured: boolean
  reading_time: number
  content_format: string
  published_at: string | null
  updated_at: string | null
  category: CmsTerm | null
  tags: CmsTerm[]
  blog_meta: Record<string, unknown>
  content?: string
}

interface CmsFeed {
  posts: CmsPost[]
  imported_slugs: string[]
}

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']

class CmsUnavailable extends Error {}

async function cmsFetch<T>(path: string, allow404 = false): Promise<T | null> {
  // The API runs on a free Render instance that sleeps when idle and takes
  // about 50 seconds to wake. undici's own timeouts allow that; try twice.
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: CMS_REVALIDATE, tags: ['cms-posts'] },
      })
      if (allow404 && res.status === 404) return null
      if (!res.ok) throw new CmsUnavailable(`CMS ${path}: HTTP ${res.status}`)
      return (await res.json()) as T
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new CmsUnavailable(String(lastError))
}

/**
 * What a CMS failure does (see the failure policy above):
 * - during `next build`: build from the files. On a deploy, Vercel builds the
 *   blog while Render may still be starting the new API; the CMS posts arrive
 *   with the first background refresh after it is up (pages refresh every
 *   CMS_REVALIDATE seconds; posts published later render on first visit).
 * - on the live site: throw, so a background refresh keeps the last good page.
 * - next dev: files only, with a warning.
 */
function offline<T>(err: unknown, fallback: T): T {
  const message = err instanceof Error ? err.message : String(err)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.warn(`[cms] ${message}; this build uses the blog's files only. CMS posts appear at the first refresh.`)
    return fallback
  }
  if (process.env.NODE_ENV === 'production') throw err
  console.warn(`[cms] ${message}; showing the blog's files only.`)
  return fallback
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const list = (v: unknown): string[] | undefined => {
  const items = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
  return items.length ? items : undefined
}
const faqList = (v: unknown): FaqItem[] | undefined => {
  const items = Array.isArray(v)
    ? v.filter((x): x is FaqItem => !!x && typeof x.q === 'string' && typeof x.a === 'string' && !!x.q && !!x.a)
    : []
  return items.length ? items : undefined
}

/** A CMS post in the shape the blog's pages already use for MDX files. */
function toMeta(p: CmsPost): PostMeta {
  const m = p.blog_meta ?? {}
  const date = (p.published_at ?? '').slice(0, 10)
  const updatedAt = text(m.dateModified)
  const articleType = ARTICLE_TYPES.find((t) => t === m.articleType) as ArticleType | undefined
  const difficulty = DIFFICULTIES.find((d) => d === m.difficulty)
  return {
    title: p.title,
    seoTitle: p.seo_title && p.seo_title !== p.title ? p.seo_title : undefined,
    description: p.seo_description || p.excerpt,
    excerpt: p.excerpt || p.seo_description,
    slug: p.slug,
    date,
    updatedAt,
    datePublished: date,
    dateModified: updatedAt ?? date,
    // The editor asks for a category; a post saved without one still needs a hub.
    category: (p.category?.name ?? 'QA Fundamentals') as Category,
    tags: p.tags.map((t) => t.name),
    author: AUTHOR.name,
    featured: p.is_featured,
    coverImage: p.featured_image || undefined,
    readingTime: `${Math.max(1, p.reading_time || 1)} min read`,
    draft: false,
    primaryQuery: text(m.primaryQuery),
    secondaryQueries: list(m.secondaryQueries),
    cluster: text(m.cluster),
    isPillar: m.isPillar === true,
    testedWith: text(m.testedWith),
    faq: faqList(m.faq),
    articleType,
    difficulty,
    tools: list(m.tools),
    keywords: list(m.keywords),
    source: 'cms',
    format: p.content_format === 'html' ? 'html' : 'mdx',
  }
}

/** Every published CMS post (no body), and the file slugs the CMS has taken over. */
export const getCmsFeed = cache(async (): Promise<{ posts: PostMeta[]; importedSlugs: Set<string> }> => {
  const empty = { posts: [], importedSlugs: new Set<string>() }
  if (!CMS_ENABLED) return empty
  try {
    const feed = await cmsFetch<CmsFeed>('/api/public/blog/posts')
    return {
      posts: (feed?.posts ?? []).filter((p) => p.published_at).map(toMeta),
      importedSlugs: new Set(feed?.imported_slugs ?? []),
    }
  } catch (err) {
    return offline(err, empty)
  }
})

/** One published CMS post with its body, or null if the CMS has no such post. */
export const getCmsPost = cache(async (slug: string): Promise<{ meta: PostMeta; content: string } | null> => {
  if (!CMS_ENABLED) return null
  try {
    const post = await cmsFetch<CmsPost>(`/api/public/blog/posts/${encodeURIComponent(slug)}`, true)
    return post && post.published_at ? { meta: toMeta(post), content: post.content ?? '' } : null
  } catch (err) {
    return offline(err, null)
  }
})

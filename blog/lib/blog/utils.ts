import { PostMeta, GroupedByTag, GroupedByCategory, PaginatedPosts } from './types'
import { NAV_SECTIONS } from './site'

export interface Heading {
  id: string
  text: string
  level: number
}

/* Heading ids exactly as rehype-slug makes them (github-slugger): lowercase,
   punctuation removed, every space becomes a hyphen (runs are not collapsed),
   and a repeated heading gets -1, -2. Built with new RegExp so the TypeScript
   target does not limit the Unicode property escapes. */
const SLUG_REMOVE = new RegExp('[^\\p{L}\\p{M}\\p{N}\\p{Pc}\\- ]', 'gu')

export function headingId(text: string, seen: Map<string, number>): string {
  const base = text.toLowerCase().replace(SLUG_REMOVE, '').replace(/ /g, '-')
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

/** Plain text of a markdown heading: links, inline HTML, code and emphasis markers removed. */
function headingText(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .trim()
}

/** Extract h2/h3 headings from MDX content for the table of contents. */
export function extractHeadings(content: string): Heading[] {
  // Fenced code blocks and MDX comments can contain lines that look like
  // headings (for example a copy-ready markdown template); they are not sections.
  const withoutCode = content
    .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const seen = new Map<string, number>()
  const headings: Heading[] = []
  let match

  while ((match = headingRegex.exec(withoutCode)) !== null) {
    const level = match[1].length
    const text = headingText(match[2])
    const id = headingId(text, seen) // every level shares one slugger, as in rehype-slug
    if (level === 2 || level === 3) headings.push({ id, text, level })
  }

  return headings
}

export const POSTS_PER_PAGE = 9

/** Sort posts newest first */
export function sortPostsByDate(posts: PostMeta[]): PostMeta[] {
  return [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

/** Get featured posts */
export function getFeaturedPosts(posts: PostMeta[], limit = 3): PostMeta[] {
  return posts.filter((p) => p.featured).slice(0, limit)
}

/** Get recent posts (excluding featured optionally) */
export function getRecentPosts(posts: PostMeta[], limit = 6): PostMeta[] {
  return sortPostsByDate(posts).slice(0, limit)
}

/** Filter posts by tag */
export function filterByTag(posts: PostMeta[], tag: string): PostMeta[] {
  return posts.filter((p) =>
    p.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
  )
}

/** Filter posts by category */
export function filterByCategory(posts: PostMeta[], category: string): PostMeta[] {
  return posts.filter(
    (p) => p.category.toLowerCase() === category.toLowerCase()
  )
}

/** Search posts by title, excerpt, tags, category */
export function searchPosts(posts: PostMeta[], query: string): PostMeta[] {
  if (!query.trim()) return posts
  const q = query.toLowerCase()
  return posts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
  )
}

/** Group posts by tag */
export function groupByTag(posts: PostMeta[]): GroupedByTag {
  return posts.reduce<GroupedByTag>((acc, post) => {
    post.tags.forEach((tag) => {
      if (!acc[tag]) acc[tag] = []
      acc[tag].push(post)
    })
    return acc
  }, {})
}

/** Group posts by category */
export function groupByCategory(posts: PostMeta[]): GroupedByCategory {
  return posts.reduce<GroupedByCategory>((acc, post) => {
    if (!acc[post.category]) acc[post.category] = []
    acc[post.category].push(post)
    return acc
  }, {})
}

/** Get all unique tags from posts */
export function getAllTags(posts: PostMeta[]): string[] {
  const tagSet = new Set<string>()
  posts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)))
  return Array.from(tagSet).sort()
}

/** Get all unique categories from posts */
export function getAllCategories(posts: PostMeta[]): string[] {
  const catSet = new Set<string>()
  posts.forEach((p) => catSet.add(p.category))
  return Array.from(catSet).sort()
}

/** A page under /blog/category/: a menu section or a single category's hub. */
export interface Hub {
  label: string
  slug: string
  categories: string[]
  /** For a section that groups categories; a single category's intro comes from its cluster. */
  intro?: string
  inMenu: boolean
}

/** Every hub: the menu sections (site.ts) first, in menu order and even before
 *  their first post, then every other category that has a post. */
/**
 * A hub page is worth indexing when it lists posts and, for a menu section
 * that groups several categories (Automation), when those posts come from at
 * least two of them. Until then it lists exactly what one category hub
 * already lists, a near duplicate, so it stays noindex and out of the sitemap.
 */
export function hubIsIndexable(hub: Hub, listed: PostMeta[]): boolean {
  if (listed.length === 0) return false
  if (hub.categories.length <= 1) return true
  return new Set(listed.map((p) => p.category)).size >= 2
}

export function getHubs(posts: PostMeta[]): Hub[] {
  const sections: Hub[] = NAV_SECTIONS.map((s) => ({
    label: s.label,
    slug: slugify(s.label),
    categories: 'categories' in s ? [...s.categories] : [s.label],
    intro: 'intro' in s ? s.intro : undefined,
    inMenu: true,
  }))
  const own = new Set(sections.filter((s) => s.categories.length === 1).map((s) => s.categories[0]))
  const rest: Hub[] = getAllCategories(posts)
    .filter((c) => !own.has(c))
    .map((c) => ({ label: c, slug: slugify(c), categories: [c], inMenu: false }))
  return [...sections, ...rest]
}

export const hubPosts = (hub: Hub, posts: PostMeta[]) => posts.filter((p) => hub.categories.includes(p.category))

/** Find related posts based on shared tags and category */
export function getRelatedPosts(
  currentPost: PostMeta,
  allPosts: PostMeta[],
  limit = 3
): PostMeta[] {
  const others = allPosts.filter((p) => p.slug !== currentPost.slug)

  const scored = others.map((post) => {
    let score = 0
    // Same cluster = 4 points, same category = 3 points
    if (currentPost.cluster && post.cluster === currentPost.cluster) score += 4
    if (post.category === currentPost.category) score += 3
    // Shared tags = 1 point each
    currentPost.tags.forEach((tag) => {
      if (post.tags.includes(tag)) score += 1
    })
    return { post, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post)
}

/** Paginate posts */
export function paginatePosts(
  posts: PostMeta[],
  page = 1,
  perPage = POSTS_PER_PAGE
): PaginatedPosts {
  const total = posts.length
  const totalPages = Math.ceil(total / perPage)
  const currentPage = Math.max(1, Math.min(page, totalPages))
  const start = (currentPage - 1) * perPage
  const paginatedPosts = posts.slice(start, start + perPage)

  return {
    posts: paginatedPosts,
    total,
    currentPage,
    totalPages,
  }
}

/** Calculate reading time if not manually set */
export function calculateReadingTime(content: string): string {
  const wordsPerMinute = 200
  const wordCount = content.trim().split(/\s+/).length
  const minutes = Math.ceil(wordCount / wordsPerMinute)
  return `${minutes} min read`
}

/** Slugify a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/** Format a date string for display, e.g. "January 8, 2025". */
export function formatDate(dateStr: string): string {
  // Dates are calendar days (YYYY-MM-DD): format in UTC so no time zone shifts them.
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Get previous and next posts for navigation */
export function getAdjacentPosts(
  currentSlug: string,
  posts: PostMeta[]
): { prev: PostMeta | null; next: PostMeta | null } {
  const sorted = sortPostsByDate(posts)
  const index = sorted.findIndex((p) => p.slug === currentSlug)
  return {
    prev: index < sorted.length - 1 ? sorted[index + 1] : null,
    next: index > 0 ? sorted[index - 1] : null,
  }
}

import { Post, PostMeta, GroupedByTag, GroupedByCategory, PaginatedPosts } from './types'

export interface Heading {
  id: string
  text: string
  level: number
}

/** Extract h2/h3 headings from MDX content string for TOC generation */
export function extractHeadings(content: string): Heading[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  const headings: Heading[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].replace(/\*\*|__|\*|_|`/g, '').trim()
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    headings.push({ id, text, level })
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

/** Filter out draft posts in production */
export function filterDrafts(posts: PostMeta[]): PostMeta[] {
  if (process.env.NODE_ENV === 'production') {
    return posts.filter((p) => !p.draft)
  }
  return posts
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

/** Find related posts based on shared tags and category */
export function getRelatedPosts(
  currentPost: PostMeta,
  allPosts: PostMeta[],
  limit = 3
): PostMeta[] {
  const others = allPosts.filter((p) => p.slug !== currentPost.slug)

  const scored = others.map((post) => {
    let score = 0
    // Same category = 3 points
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

/** Format a date string for display */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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

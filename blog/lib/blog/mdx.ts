import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { PostFrontmatter, PostMeta } from './types'
import { calculateReadingTime, sortPostsByDate } from './utils'
import { SHOW_DRAFTS } from './site'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')

/** YAML turns an unquoted 2026-01-31 into a Date; the rest of the code wants the string. */
function toDateString(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

/** Accept both date naming schemes and expose one. */
function normalise(data: Record<string, unknown>, slug: string, content: string): PostMeta {
  const fm = data as unknown as PostFrontmatter
  const date = toDateString(fm.datePublished ?? fm.date) ?? ''
  const updatedAt = toDateString(fm.dateModified ?? fm.updatedAt)

  return {
    ...fm,
    slug,
    date,
    updatedAt,
    datePublished: date,
    dateModified: updatedAt ?? date,
    readingTime: fm.readingTime ?? calculateReadingTime(content),
  }
}

function readPost(slug: string): { meta: PostMeta; content: string } | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'))
  return { meta: normalise(data, slug, content), content }
}

function allSlugsOnDisk(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''))
}

/** Read and parse a single MDX file by slug. A draft does not exist in production. */
export function getPostBySlug(slug: string): { meta: PostMeta; content: string } | null {
  const post = readPost(slug)
  if (!post) return null
  if (post.meta.draft && !SHOW_DRAFTS) return null
  return post
}

/** Metadata for every visible post, newest first (no content). */
export function getAllPostsMeta(): PostMeta[] {
  const posts = allSlugsOnDisk()
    .map((slug) => readPost(slug)?.meta)
    .filter((meta): meta is PostMeta => Boolean(meta))
    .filter((meta) => SHOW_DRAFTS || !meta.draft)

  return sortPostsByDate(posts)
}

/** Slugs for static param generation. Drafts get no page in production. */
export function getAllSlugs(): string[] {
  return getAllPostsMeta().map((p) => p.slug)
}

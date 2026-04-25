import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { PostFrontmatter, PostMeta } from './types'
import { calculateReadingTime, filterDrafts, sortPostsByDate } from './utils'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')

/** Read and parse a single MDX file by slug */
export function getPostBySlug(slug: string): { meta: PostMeta; content: string } | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)

  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  const frontmatter = data as PostFrontmatter
  const readingTime = frontmatter.readingTime ?? calculateReadingTime(content)

  return {
    meta: {
      ...frontmatter,
      slug,
      readingTime,
    },
    content,
  }
}

/** Get metadata for all posts (no content) */
export function getAllPostsMeta(): PostMeta[] {
  if (!fs.existsSync(CONTENT_DIR)) return []

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'))

  const posts = files.map((file) => {
    const slug = file.replace(/\.mdx$/, '')
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8')
    const { data, content } = matter(raw)
    const frontmatter = data as PostFrontmatter
    const readingTime = frontmatter.readingTime ?? calculateReadingTime(content)

    return {
      ...frontmatter,
      slug,
      readingTime,
    } as PostMeta
  })

  return sortPostsByDate(filterDrafts(posts))
}

/** Get all slugs for static param generation */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''))
}

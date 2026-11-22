/**
 * Every post on the blog: the MDX files in content/blog plus the posts
 * published in the CMS. Pages read posts only through this module.
 *
 * - A CMS post wins over a file with the same slug.
 * - A file the CMS has taken over (imported_slugs) is hidden even when the CMS
 *   post is unpublished or deleted, so taking it off in the CMS takes it off
 *   the blog.
 */
import { cache } from 'react'
import { getAllPostsMeta as getFilePostsMeta, getPostBySlug as getFilePost } from './mdx'
import { getCmsFeed, getCmsPost } from './cms'
import type { PostMeta } from './types'
import { sortPostsByDate } from './utils'

export interface LoadedPost {
  meta: PostMeta
  content: string
}

const fromFile = (meta: PostMeta): PostMeta => ({ ...meta, source: 'file', format: 'mdx' })

/** Metadata for every visible post, newest first (no bodies). */
export const getAllPostsMeta = cache(async (): Promise<PostMeta[]> => {
  const { posts: cms, importedSlugs } = await getCmsFeed()
  const taken = new Set(cms.map((p) => p.slug))
  importedSlugs.forEach((slug) => taken.add(slug))
  const files = getFilePostsMeta().filter((p) => !taken.has(p.slug)).map(fromFile)
  return sortPostsByDate([...cms, ...files])
})

/** One visible post with its body, or null. */
export const getPostBySlug = cache(async (slug: string): Promise<LoadedPost | null> => {
  const cms = await getCmsPost(slug)
  if (cms) return cms
  const { importedSlugs } = await getCmsFeed()
  if (importedSlugs.has(slug)) return null
  const file = getFilePost(slug)
  return file ? { meta: fromFile(file.meta), content: file.content } : null
})

/** Slugs of every visible post. */
export async function getAllSlugs(): Promise<string[]> {
  return (await getAllPostsMeta()).map((p) => p.slug)
}

#!/usr/bin/env node
/**
 * Copy the blog's MDX articles into a JSON file the CMS imports once at startup
 * (cms/backend/app/core/blog_import.py). Front matter and body are kept exactly;
 * the CMS stores the body as Markdown (MDX), so every component still renders.
 *
 *   node scripts/export-posts-for-cms.mjs
 *
 * Writes cms/backend/app/seed_content/blog_articles.json. Drafts are left out.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const here = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.join(here, '..', 'content', 'blog')
const outFile = path.join(here, '..', '..', 'cms', 'backend', 'app', 'seed_content', 'blog_articles.json')

const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v) : undefined)

const articles = fs.readdirSync(contentDir)
  .filter((f) => f.endsWith('.mdx'))
  .sort()
  .map((file) => {
    const { data, content } = matter(fs.readFileSync(path.join(contentDir, file), 'utf-8'))
    return { fm: data, slug: data.slug || file.replace(/\.mdx$/, ''), body: content.replace(/^\n+/, '') }
  })
  .filter(({ fm }) => !fm.draft)
  .map(({ fm, slug, body }) => ({
    slug,
    title: fm.title,
    description: fm.description ?? '',
    excerpt: fm.excerpt ?? '',
    datePublished: day(fm.datePublished ?? fm.date),
    dateModified: day(fm.dateModified ?? fm.updatedAt) ?? null,
    category: fm.category,
    tags: fm.tags ?? [],
    featured: Boolean(fm.featured),
    blogMeta: {
      primaryQuery: fm.primaryQuery ?? '',
      secondaryQueries: fm.secondaryQueries ?? [],
      cluster: fm.cluster ?? '',
      isPillar: Boolean(fm.isPillar),
      testedWith: fm.testedWith ?? '',
      faq: fm.faq ?? [],
      articleType: fm.articleType ?? null,
      difficulty: fm.difficulty ?? null,
      tools: fm.tools ?? [],
      keywords: fm.keywords ?? [],
      dateModified: day(fm.dateModified ?? fm.updatedAt) ?? null,
    },
    body,
  }))

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(articles, null, 2) + '\n')
console.log(`Wrote ${articles.length} article(s) to ${path.relative(process.cwd(), outFile)}`)

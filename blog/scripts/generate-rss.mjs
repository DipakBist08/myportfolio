/**
 * Generates public/rss.xml at build time.
 * Run before `next build` — reads MDX frontmatter via gray-matter.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT       = path.join(__dirname, '..')
const CONTENT    = path.join(ROOT, 'content', 'blog')
const PUBLIC     = path.join(ROOT, 'public')
const BASE_URL   = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

function getPosts() {
  if (!fs.existsSync(CONTENT)) return []
  return fs
    .readdirSync(CONTENT)
    .filter((f) => f.endsWith('.mdx'))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '')
      const { data } = matter(fs.readFileSync(path.join(CONTENT, file), 'utf-8'))
      return { slug, ...data }
    })
    .filter((p) => p.status !== 'draft' && p.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

const posts = getPosts()

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Dipak Bist | QA Blog</title>
    <link>${BASE_URL}</link>
    <description>Articles on Software QA, automation testing, Playwright, API testing, and QA career tips.</description>
    <language>en-US</language>
    <managingEditor>mbdds54@gmail.com (Dipak Bist)</managingEditor>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${posts.map((post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerpt || post.description || ''}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category><![CDATA[${post.category || ''}]]></category>
      ${(post.tags || []).map((t) => `<category><![CDATA[${t}]]></category>`).join('\n      ')}
    </item>`).join('')}
  </channel>
</rss>`

fs.mkdirSync(PUBLIC, { recursive: true })
fs.writeFileSync(path.join(PUBLIC, 'rss.xml'), rss)
console.log(`✅  rss.xml generated (${posts.length} posts)`)

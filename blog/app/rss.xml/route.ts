import { getAllPostsMeta } from '@/lib/blog/mdx'
import { formatDate } from '@/lib/blog/utils'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

export async function GET() {
  const posts = getAllPostsMeta()

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Dipak Bist | QA Blog</title>
    <link>${BASE_URL}</link>
    <description>Articles on Software QA, automation testing, Playwright, API testing, and QA career tips.</description>
    <language>en-US</language>
    <managingEditor>dipakbeest@gmail.com (Dipak Bist)</managingEditor>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${posts
      .map(
        (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category><![CDATA[${post.category}]]></category>
      ${post.tags.map((t) => `<category><![CDATA[${t}]]></category>`).join('\n      ')}
    </item>`
      )
      .join('')}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

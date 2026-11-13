import { MetadataRoute } from 'next'
import { BASE_URL } from '@/lib/blog/site'

/* Every crawler is allowed, including AI search crawlers (GPTBot, OAI-SearchBot,
   PerplexityBot, ClaudeBot, Google-Extended and the rest): there is no
   per-bot rule and nothing is disallowed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}

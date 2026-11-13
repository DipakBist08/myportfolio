import sections from './sections.json'
/** Site-wide constants. One place, so titles, schema and feeds cannot drift apart. */
import type { Category } from './types'

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'
export const PORTFOLIO_URL = 'https://dipakbist.com.np/'
export const SITE_NAME = 'Dipak Bist QA Blog'
export const TITLE_SUFFIX = ' | Dipak Bist'
export const SITE_LANGUAGE = 'en-US'

export const AUTHOR = {
  name: 'Dipak Bist',
  jobTitle: 'Software QA Engineer',
  location: 'Kathmandu, Nepal',
  url: PORTFOLIO_URL,
  sameAs: ['https://www.linkedin.com/in/dipakbist', 'https://github.com/DipakBist08'],
} as const

/** schema.org Person, reused by every page that names the author. */
export const AUTHOR_LD = {
  '@type': 'Person',
  '@id': `${PORTFOLIO_URL}#person`,
  name: AUTHOR.name,
  jobTitle: AUTHOR.jobTitle,
  url: AUTHOR.url,
  sameAs: [...AUTHOR.sameAs],
}

/** Drafts are visible in `next dev`, and in a production build only when SHOW_DRAFTS=true (local previews). */
export const SHOW_DRAFTS = process.env.NODE_ENV !== 'production' || process.env.SHOW_DRAFTS === 'true'

/** The menu after "Articles", in this order. A section named after one category
 *  links to that category's hub. A section that groups several categories gets
 *  its own page at /blog/category/<slug of its label>, listing all their posts;
 *  the categories keep their own hubs too. Every section is in the menu even
 *  before it has a post: its page then shows its intro, is noindex and stays
 *  out of the sitemap until the first post is published. */
export type NavSection =
  | { label: Category }
  | { label: string; categories: readonly Category[]; intro: string }

/* The menu, in order. The data lives in sections.json so scripts/seo-lint.mjs
   knows these hub pages exist (a link to /blog/category/automation is valid). */
export const NAV_SECTIONS = sections as readonly NavSection[]

export const postUrl = (slug: string) => `${BASE_URL}/blog/${slug}`
/** Static 1200x630 share card, generated at build time by app/og/[slug]/route.tsx. */
export const postOgImage = (slug: string) => `${BASE_URL}/og/${slug}`

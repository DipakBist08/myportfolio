import sections from './sections.json'
/** Site-wide constants. One place, so titles, schema and feeds cannot drift apart. */
import type { Category } from './types'

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'
/** The home page's URL as the brief writes it, with its "/" path (sitemap, JSON-LD). Next.js prints the
 *  root canonical and og:url without the slash; for a root URL both forms are the same URL (RFC 3986,
 *  section 6.2.3), and search engines treat them as one. */
export const HOME_URL = `${BASE_URL}/`
export const PORTFOLIO_URL = 'https://dipakbist.com.np/'
export const SITE_NAME = 'Dipak Bist QA Blog'
export const TITLE_SUFFIX = ' | Dipak Bist'
export const SITE_LANGUAGE = 'en-US'

/** The home page's title and description, and the blog's own description: the owner's
 *  QA-blog SEO brief of 19/11/2026 (Phase 3), with the author's name as Bist. The title is
 *  70 characters, longer than a results page shows; the owner chose it, and its first part
 *  carries the topic. */
export const HOME_TITLE = 'QA Engineering Blog | Playwright, Automation & AI Testing – Dipak Bist'
export const HOME_DESCRIPTION =
  'Explore practical QA engineering tutorials, software testing, Playwright automation, AI-powered testing, AI agents, API testing and CI/CD insights by Dipak Bist.'
/* The owner added database and performance testing to the home heading and this description (19/11/2026). */
export const SITE_DESCRIPTION =
  'A practical knowledge hub covering Quality Assurance, software testing, Playwright automation, AI-powered testing, AI agents, API, database and performance testing, and modern QA engineering practices.'

/** The author's X account, for twitter:site and twitter:creator on every page. */
export const X_HANDLE = '@Deepak_B_08'

/** The author's public profiles, exactly as the owner supplied them (SEO brief of 18/11/2026,
 *  Part 2), in the order used everywhere: the professional profiles first, then the social ones.
 *  The portfolio's Person (https://dipakbist.com.np/#person) lists the same five, in this order. */
export const PROFILES = [
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/dipakbist/' },
  { id: 'github', label: 'GitHub', url: 'https://github.com/DipakBist08' },
  { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/dipak.beesta' },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/dipak.beest/' },
  { id: 'x', label: 'X', url: 'https://x.com/Deepak_B_08' },
] as const

export type Profile = (typeof PROFILES)[number]

export const AUTHOR = {
  name: 'Dipak Bist',
  jobTitle: 'Software QA Engineer',
  location: 'Kathmandu, Nepal',
  url: PORTFOLIO_URL,
  sameAs: PROFILES.map((p) => p.url),
} as const

/** schema.org Person, reused by every page that names the author. It carries the portfolio's
 *  @id, so it is the same entity, and it stands alone too: Google reads each page's markup on its
 *  own and does not fetch an @id from another host. */
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

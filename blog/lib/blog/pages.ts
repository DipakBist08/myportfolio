/** The site's plain pages and the date each one's content last changed. The sitemap uses these as
 *  <lastmod>, and the policy pages show them as "Last updated", so update a date only when the page's
 *  text changes, never for code-only edits. (Page files can export only what Next.js expects, so the
 *  dates live here.) */
export const SITE_PAGES = {
  about: { path: '/about', updated: '2026-11-18' },
  contact: { path: '/contact', updated: '2026-11-18' },
  privacyPolicy: { path: '/privacy-policy', updated: '2026-11-19' },
  disclaimer: { path: '/disclaimer', updated: '2026-11-12' },
} as const

import type { Metadata } from 'next'
import { BASE_URL, HOME_URL, SITE_NAME, TITLE_SUFFIX, X_HANDLE } from './site'

export const DEFAULT_SHARE_IMAGE = { url: `${BASE_URL}/og-default.png`, width: 1200, height: 630, alt: SITE_NAME }

interface PageMeta {
  /** The page's own title; the " | Dipak Bist" suffix is added unless `absoluteTitle` is set. */
  title: string
  description: string
  /** Path from the site root: "/" for the home page, "/about", "/blog/tag/pytest". */
  path: string
  absoluteTitle?: boolean
  robots?: Metadata['robots']
}

/**
 * Title, description, canonical, Open Graph and X card for one page, all built from the same
 * values. Next.js replaces (does not merge) a parent's `openGraph` and `twitter` objects, so a
 * page that set only its title used to inherit the home page's og:url and og:title. Every page
 * except the posts (which add article dates) uses this.
 */
export function pageMetadata({ title, description, path, absoluteTitle = false, robots }: PageMeta): Metadata {
  const url = path === '/' ? HOME_URL : `${BASE_URL}${path}`
  const fullTitle = absoluteTitle ? title : `${title}${TITLE_SUFFIX}`
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    ...(robots ? { robots } : {}),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      site: X_HANDLE,
      creator: X_HANDLE,
      title: fullTitle,
      description,
      images: [DEFAULT_SHARE_IMAGE.url],
    },
  }
}

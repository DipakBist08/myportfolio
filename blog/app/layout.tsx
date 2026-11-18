import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import PageViewTracker from '@/components/blog/PageViewTracker'
import { BASE_URL, HOME_DESCRIPTION, HOME_TITLE, PORTFOLIO_URL, SITE_NAME, TITLE_SUFFIX, X_HANDLE } from '@/lib/blog/site'
import { DEFAULT_SHARE_IMAGE } from '@/lib/blog/metadata'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import { getHubs, slugify } from '@/lib/blog/utils'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: HOME_TITLE,
    template: `%s${TITLE_SUFFIX}`,
  },
  description: HOME_DESCRIPTION,
  authors: [{ name: 'Dipak Bist', url: PORTFOLIO_URL }],
  creator: 'Dipak Bist',
  // No canonical here: a canonical set in the root layout is inherited by every
  // route that does not set its own, which would point them all at the home page.
  alternates: {
    types: { 'application/rss+xml': `${BASE_URL}/rss.xml` },
  },
  // Site-wide fallbacks only. Every page sets its own url, title and description
  // (lib/blog/metadata.ts); a fallback naming the home page would leak onto pages
  // that forgot to, as og:url did on /about, /contact and the tag pages.
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SITE_NAME,
    images: [DEFAULT_SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    site: X_HANDLE,
    creator: X_HANDLE,
    images: [DEFAULT_SHARE_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

/* Applies the stored or system theme before first paint. The key is shared
   with the portfolio, so a choice made on one site carries to the other. */
const themeScript = `(function(){try{var s=localStorage.getItem('portfolio-theme');var t=s==='light'||s==='dark'?s:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');var h=document.documentElement;h.setAttribute('data-theme',t);h.classList.toggle('light',t==='light');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The menu is "Articles" plus the sections in lib/blog/site.ts, in that order.
  // The footer adds every other category hub that has a published post.
  const hubs = getHubs(getAllPostsMeta().filter((p) => !p.draft))
  const categoryLinks = hubs.map((h) => ({ href: `/blog/category/${h.slug}`, label: h.label }))
  const menuLinks = hubs
    .filter((h) => h.inMenu)
    .map((h) => ({
      href: `/blog/category/${h.slug}`,
      label: h.label,
      // A section that groups categories stays highlighted on their hubs too.
      also: h.categories.length > 1 ? h.categories.map((c) => `/blog/category/${slugify(c)}`) : undefined,
    }))

  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preload" href="/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#0b0b0e" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <link rel="alternate" type="application/rss+xml" title="Dipak Bist QA Blog RSS" href="/rss.xml" />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <a href="#main" className="skip-link">Skip to content</a>
          <Navbar links={[{ href: '/', label: 'Articles' }, ...menuLinks]} />
          <main id="main" className="flex-1" tabIndex={-1}>{children}</main>
          <Footer categoryLinks={categoryLinks} />
          <PageViewTracker />
        </ThemeProvider>
      </body>
    </html>
  )
}

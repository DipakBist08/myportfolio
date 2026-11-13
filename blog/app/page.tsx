import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import BlogPageContent, { BlogPageView } from '@/components/blog/BlogPageContent'
import { AUTHOR_LD, BASE_URL, SITE_LANGUAGE, SITE_NAME } from '@/lib/blog/site'

const HOME_TITLE = 'Dipak Bist | QA Engineering Blog'
const HOME_DESCRIPTION =
  'Practical, tested guides on Playwright with Python, API testing, bug reporting and QA careers, written by Dipak Bist, a Software QA Engineer in Kathmandu.'

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    url: BASE_URL,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    siteName: SITE_NAME,
    images: [{ url: `${BASE_URL}/og-default.png`, width: 1200, height: 630, alt: SITE_NAME }],
  },
}

const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  '@id': `${BASE_URL}/#blog`,
  name: SITE_NAME,
  url: BASE_URL,
  inLanguage: SITE_LANGUAGE,
  description: HOME_DESCRIPTION,
  author: AUTHOR_LD,
  publisher: AUTHOR_LD,
}

export default function BlogPage() {
  const allPosts = getAllPostsMeta()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      {/* The fallback is the full, unfiltered list. It is what crawlers and
          no-JavaScript readers get; BlogPageContent replaces it with the same
          view once the URL filters can be read in the browser. */}
      <Suspense fallback={<BlogPageView allPosts={allPosts} />}>
        <BlogPageContent allPosts={allPosts} />
      </Suspense>
    </>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import BlogPageContent, { BlogPageView } from '@/components/blog/BlogPageContent'
import { AUTHOR_LD, BASE_URL, HOME_DESCRIPTION, HOME_TITLE, HOME_URL, SITE_DESCRIPTION, SITE_LANGUAGE, SITE_NAME } from '@/lib/blog/site'
import { pageMetadata } from '@/lib/blog/metadata'

export const metadata: Metadata = pageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: '/', absoluteTitle: true })

const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  '@id': `${BASE_URL}/#blog`,
  name: SITE_NAME,
  url: HOME_URL,
  inLanguage: SITE_LANGUAGE,
  description: SITE_DESCRIPTION,
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

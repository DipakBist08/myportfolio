import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { getAllPostsMeta } from '@/lib/blog/mdx'

const BlogPageContent = dynamic(
  () => import('@/components/blog/BlogPageContent'),
  {
    ssr: false,
    loading: () => <div className="mx-auto max-w-6xl px-6 py-12 text-slate-400">Loading…</div>,
  }
)

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Articles on Software QA, automation testing, Playwright, API testing, bug reporting, and QA career tips by Dipak Bist.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    url: BASE_URL,
    title: 'Dipak Bist | QA Engineering Blog',
    description: 'Practical articles on test automation, Playwright, API testing, bug reporting, and QA career tips.',
    siteName: 'Dipak Bist QA Blog',
  },
}

const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${BASE_URL}/#website`,
  name: 'Dipak Bist QA Blog',
  url: BASE_URL,
  description: 'Practical articles on software testing, automation, Playwright, API testing and QA career tips.',
  author: {
    '@type': 'Person',
    name: 'Dipak Bist',
    url: 'https://dipakbist.com',
    sameAs: [
      'https://www.linkedin.com/in/dipakbist08/',
      'https://github.com/dipakbist08',
      'https://twitter.com/dipakbist08',
    ],
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

export default function BlogPage() {
  const allPosts = getAllPostsMeta()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <BlogPageContent allPosts={allPosts} />
    </>
  )
}

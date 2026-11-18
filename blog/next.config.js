/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Category renamed on 2026-11-13: "Manual Testing" and "Bug Reporting" became
  // "QA Fundamentals", and the "QA Fundamentals" tag was dropped so it does not
  // duplicate the category. Old URLs answer 301 to the new hub.
  async redirects() {
    return [
      { source: '/blog/category/manual-testing', destination: '/blog/category/qa-fundamentals', statusCode: 301 },
      { source: '/blog/category/bug-reporting', destination: '/blog/category/qa-fundamentals', statusCode: 301 },
      { source: '/blog/tag/qa-fundamentals', destination: '/blog/category/qa-fundamentals', statusCode: 301 },
      // Posts live under /blog/<slug>, so /blog is a natural guess; the article list is the home page.
      { source: '/blog', destination: '/', permanent: true },
    ]
  },
}

module.exports = nextConfig

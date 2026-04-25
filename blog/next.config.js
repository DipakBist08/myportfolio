/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',         // static export — required for Cloudflare Pages
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  images: {
    unoptimized: true,      // required for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig

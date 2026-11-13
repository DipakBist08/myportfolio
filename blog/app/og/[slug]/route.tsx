import { ImageResponse } from 'next/og'
import { getAllSlugs, getPostBySlug } from '@/lib/blog/mdx'
import { AUTHOR } from '@/lib/blog/site'

/* A 1200x630 share card for every post, drawn from the post's own title and
   category. Generated once at build time as a static PNG: no stock photo, no
   request-time rendering. Linked from each post's og:image and twitter:image. */
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export function GET(_request: Request, { params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)
  const title = post?.meta.title ?? 'Dipak Bist QA Blog'
  const category = post?.meta.category ?? 'QA Engineering'
  const titleSize = title.length > 70 ? 54 : title.length > 45 ? 62 : 72

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: '#0b0b0e',
          color: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, color: '#a5b4fc' }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: '#4ade80', marginRight: 16 }} />
          {category}
        </div>

        <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.02em' }}>
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '2px solid #222227',
            paddingTop: 28,
            fontSize: 28,
          }}
        >
          <div style={{ display: 'flex' }}>
            {AUTHOR.name}
            <span style={{ color: '#a1a1aa', marginLeft: 12 }}>{`\u2014 ${AUTHOR.jobTitle}`}</span>
          </div>
          <div style={{ display: 'flex', color: '#a1a1aa' }}>blog.dipakbist.com.np</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

import Link from 'next/link'
import { PostMeta } from '@/lib/blog/types'
import { formatDate } from '@/lib/blog/utils'

interface RelatedPostsProps {
  posts: PostMeta[]
}

export default function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null

  return (
    <section aria-label="Related posts">
      <h2 className="mb-5 font-heading text-xl font-bold text-ink light:text-muted">
        Related Articles
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-xl border border-line bg-surface-card p-4 transition-all hover:border-primary hover:bg-surface-card hover:-translate-y-0.5 light:border-line light:bg-white"
          >
            <div className="mb-2">
              <span className="inline-flex items-center rounded-md border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                {post.category}
              </span>
            </div>
            <h3 className="mb-1 text-sm font-semibold text-ink group-hover:text-ink transition-colors line-clamp-2 light:text-muted">
              {post.title}
            </h3>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span>·</span>
              <span>{post.readingTime}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

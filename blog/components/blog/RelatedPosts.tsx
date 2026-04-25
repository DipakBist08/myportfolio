import Link from 'next/link'
import { PostMeta } from '@/lib/blog/types'
import { formatDate } from '@/lib/blog/utils'
import CategoryBadge from './CategoryBadge'

interface RelatedPostsProps {
  posts: PostMeta[]
}

export default function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null

  return (
    <section aria-label="Related posts">
      <h2 className="mb-5 font-heading text-xl font-bold text-slate-100 light:text-slate-900">
        Related Articles
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-xl border border-slate-700/50 bg-surface-card/50 p-4 transition-all hover:border-primary/40 hover:bg-surface-card hover:-translate-y-0.5 light:border-slate-200 light:bg-white"
          >
            <div className="mb-2">
              <CategoryBadge category={post.category} />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-200 group-hover:text-primary-light transition-colors line-clamp-2 light:text-slate-800">
              {post.title}
            </h3>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
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

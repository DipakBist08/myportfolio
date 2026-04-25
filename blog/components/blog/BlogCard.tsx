import Link from 'next/link'
import Image from 'next/image'
import { PostMeta } from '@/lib/blog/types'
import { formatDate } from '@/lib/blog/utils'
import TagBadge from './TagBadge'
import CategoryBadge from './CategoryBadge'

interface BlogCardProps {
  post: PostMeta
  featured?: boolean
}

const difficultyColors = {
  beginner: 'text-green-500 bg-green-500/10 border-green-500/25 light:bg-green-50 light:border-green-200',
  intermediate: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/25 light:bg-yellow-50 light:border-yellow-200',
  advanced: 'text-red-500 bg-red-500/10 border-red-500/25 light:bg-red-50 light:border-red-200',
}

export default function BlogCard({ post, featured }: BlogCardProps) {
  return (
    <article className={`blog-card flex flex-col ${featured ? 'md:flex-row' : ''}`}>

      {/* Cover image */}
      {post.coverImage ? (
        <Link
          href={`/blog/${post.slug}`}
          className={`block overflow-hidden ${featured ? 'md:w-2/5 shrink-0' : 'aspect-video'}`}
        >
          <Image
            src={post.coverImage}
            alt={post.title}
            width={800}
            height={450}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </Link>
      ) : (
        /* Placeholder when no cover image */
        <Link
          href={`/blog/${post.slug}`}
          className="group block aspect-video overflow-hidden bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/10 light:from-indigo-50 light:via-purple-50 light:to-cyan-50 flex items-center justify-center"
        >
          <div className="text-center px-4">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 light:bg-primary/10 light:border-primary/20 group-hover:scale-110 transition-transform duration-300">
              <svg className="h-6 w-6 text-primary-light light:text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-xs font-mono text-slate-500 light:text-slate-400">{post.category}</p>
          </div>
        </Link>
      )}

      {/* Card content */}
      <div className="flex flex-1 flex-col p-5">

        {/* Top badges */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CategoryBadge category={post.category} />
          {post.difficulty && (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${difficultyColors[post.difficulty]}`}>
              {post.difficulty}
            </span>
          )}
          {post.featured && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-500 light:bg-yellow-50 light:border-yellow-200 light:text-yellow-600">
              ★ Featured
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/blog/${post.slug}`}>
          <h2 className={`font-heading font-bold text-slate-100 hover:text-primary-light light:text-slate-900 light:hover:text-primary transition-colors leading-snug ${featured ? 'text-xl mb-2' : 'text-lg mb-1.5'}`}>
            {post.title}
          </h2>
        </Link>

        {/* Excerpt */}
        <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-400 light:text-slate-500 line-clamp-2">
          {post.excerpt}
        </p>

        {/* Tags */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 4).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700/30 light:border-slate-100 pt-3 text-xs text-slate-500 light:text-slate-400">
          <div className="flex items-center gap-2.5">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="text-slate-600 light:text-slate-300">·</span>
            <span>{post.readingTime}</span>
          </div>
          <Link
            href={`/blog/${post.slug}`}
            className="flex items-center gap-1 font-medium text-primary-light/70 hover:text-primary-light light:text-primary/60 light:hover:text-primary transition-colors"
          >
            Read
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}

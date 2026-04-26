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
  beginner:     'text-green-400 bg-green-500/10 border-green-500/25',
  intermediate: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
  advanced:     'text-red-400 bg-red-500/10 border-red-500/25',
}

function CoverImage({ post, featured }: { post: PostMeta; featured?: boolean }) {
  const cls = featured
    ? 'block h-56 sm:h-72 overflow-hidden rounded-t-xl'
    : 'block aspect-video overflow-hidden rounded-t-xl'

  if (post.coverImage) {
    return (
      <Link href={`/blog/${post.slug}`} className={`${cls} group`}>
        <Image
          src={post.coverImage}
          alt={post.title}
          width={800}
          height={450}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>
    )
  }

  const icons: Record<string, string> = {
    'API Testing':        '🌐',
    'Automation Testing': '🤖',
    'Manual Testing':     '✅',
    'Bug Reporting':      '🐛',
    'CI/CD':              '⚙️',
    'Python':             '🐍',
    'QA Career':          '🎯',
    'Test Planning':      '📋',
  }
  const emoji = icons[post.category] ?? '📝'

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`${cls} group flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/10`}
    >
      <div className="text-center">
        <div className={`mx-auto flex items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 group-hover:scale-110 transition-transform duration-300 ${featured ? 'h-16 w-16 text-3xl mb-2' : 'h-12 w-12 text-xl mb-1.5'}`}>
          {emoji}
        </div>
        <p className="text-xs font-mono text-slate-500">{post.category}</p>
      </div>
    </Link>
  )
}

export default function BlogCard({ post, featured }: BlogCardProps) {
  return (
    <article className={`blog-card group flex flex-col h-full transition-all duration-200 hover:-translate-y-0.5 ${featured ? 'ring-1 ring-primary/20' : ''}`}>
      <CoverImage post={post} featured={featured} />

      <div className="flex flex-1 flex-col p-5">
        {/* Badges */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CategoryBadge category={post.category} />
          {post.difficulty && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${difficultyColors[post.difficulty]}`}>
              {post.difficulty}
            </span>
          )}
          {post.featured && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
              ★ Featured
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/blog/${post.slug}`}>
          <h2 className={`font-heading font-bold text-slate-100 group-hover:text-primary-light transition-colors leading-snug ${featured ? 'text-xl mb-2.5' : 'text-base mb-1.5'}`}>
            {post.title}
          </h2>
        </Link>

        {/* Excerpt */}
        <p className={`mb-4 flex-1 text-sm leading-relaxed text-slate-400 ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>
          {post.excerpt}
        </p>

        {/* Tags */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {post.tags.slice(0, featured ? 5 : 3).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700/30 pt-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="text-slate-700">·</span>
            <span>{post.readingTime}</span>
          </div>
          <Link
            href={`/blog/${post.slug}`}
            className="flex items-center gap-1 font-semibold text-primary-light/70 hover:text-primary-light transition-colors"
          >
            Read
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}

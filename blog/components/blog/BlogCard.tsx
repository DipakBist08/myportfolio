import Link from 'next/link'
import Image from 'next/image'
import { PostMeta } from '@/lib/blog/types'
import { formatDate } from '@/lib/blog/utils'
import TagBadge from './TagBadge'

interface BlogCardProps {
  post: PostMeta
  featured?: boolean
}

/* A plain card: real cover image if the post has one, mono metadata, title,
   excerpt, tags. No placeholder art, no badges that are not facts. */
export default function BlogCard({ post, featured }: BlogCardProps) {
  const href = `/blog/${post.slug}`
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface-card transition-[border-color,transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-line-strong hover:shadow-card-hover light:bg-white">
      {post.coverImage && (
        <Link href={href} className="block aspect-video overflow-hidden border-b border-line" tabIndex={-1} aria-hidden="true">
          <Image
            src={post.coverImage}
            alt=""
            width={800}
            height={450}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </Link>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="mono-label flex flex-wrap items-center gap-x-2">
          <span className="text-primary-light">{post.category}</span>
          <span aria-hidden="true">&middot;</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span aria-hidden="true">&middot;</span>
          <span>{post.readingTime}</span>
        </p>

        <h2 className={`font-semibold leading-snug text-ink ${featured ? 'text-2xl' : 'text-lg'}`}>
          <Link href={href} className="no-underline transition-colors hover:text-primary-light">
            {post.title}
          </Link>
        </h2>

        <p className={`text-sm leading-relaxed text-muted ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>
          {post.excerpt}
        </p>

        <ul className="mt-auto flex flex-wrap gap-1.5 pt-2" aria-label="Tags">
          {post.tags.slice(0, featured ? 5 : 3).map((tag) => (
            <li key={tag}><TagBadge tag={tag} /></li>
          ))}
        </ul>
      </div>
    </article>
  )
}

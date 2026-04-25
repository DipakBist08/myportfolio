import Link from 'next/link'
import { PostMeta } from '@/lib/blog/types'

interface PostNavigationProps {
  prev: PostMeta | null
  next: PostMeta | null
}

export default function PostNavigation({ prev, next }: PostNavigationProps) {
  if (!prev && !next) return null

  return (
    <nav
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      aria-label="Post navigation"
    >
      {prev ? (
        <Link
          href={`/blog/${prev.slug}`}
          className="group flex flex-col rounded-xl border border-slate-700/50 bg-surface-card/50 p-4 transition-all hover:border-primary/40 hover:bg-surface-card light:border-slate-200 light:bg-white"
        >
          <span className="mb-1 flex items-center gap-1 text-xs text-slate-500">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Previous
          </span>
          <span className="text-sm font-medium text-slate-300 group-hover:text-primary-light transition-colors line-clamp-2 light:text-slate-700">
            {prev.title}
          </span>
        </Link>
      ) : <div />}

      {next ? (
        <Link
          href={`/blog/${next.slug}`}
          className="group flex flex-col items-end rounded-xl border border-slate-700/50 bg-surface-card/50 p-4 text-right transition-all hover:border-primary/40 hover:bg-surface-card sm:col-start-2 light:border-slate-200 light:bg-white"
        >
          <span className="mb-1 flex items-center gap-1 text-xs text-slate-500">
            Next
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-sm font-medium text-slate-300 group-hover:text-primary-light transition-colors line-clamp-2 light:text-slate-700">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  )
}

import Link from 'next/link'
import { slugify } from '@/lib/blog/utils'

interface TagBadgeProps {
  tag: string
  count?: number
  active?: boolean
  size?: 'sm' | 'md'
}

export default function TagBadge({ tag, count, active, size = 'sm' }: TagBadgeProps) {
  return (
    <Link
      href={`/blog/tag/${slugify(tag)}`}
      className={`inline-flex items-center gap-1 rounded-full border font-medium transition-all ${
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${
        active
          ? 'border-primary bg-primary/20 text-primary-light light:bg-indigo-100 light:border-indigo-300 light:text-indigo-700'
          : 'border-slate-700/50 bg-slate-800/50 text-slate-400 hover:border-primary/50 hover:bg-primary/10 hover:text-primary-light light:border-slate-200 light:bg-slate-100 light:text-slate-600 light:hover:border-indigo-300 light:hover:bg-indigo-50 light:hover:text-indigo-700'
      }`}
    >
      <span>#{tag}</span>
      {count !== undefined && <span className="opacity-60">{count}</span>}
    </Link>
  )
}

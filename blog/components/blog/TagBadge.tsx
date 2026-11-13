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
      aria-current={active ? 'true' : undefined}
      className={`chip ${size === 'sm' ? 'min-h-7 px-2.5 text-xs' : ''}`}
    >
      <span>{tag}</span>
      {count !== undefined && <span className="ml-1 font-mono text-[0.7rem] opacity-70">{count}</span>}
    </Link>
  )
}

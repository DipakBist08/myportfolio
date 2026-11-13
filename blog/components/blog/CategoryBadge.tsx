import Link from 'next/link'
import { slugify } from '@/lib/blog/utils'

interface CategoryBadgeProps {
  category: string
  active?: boolean
}

export default function CategoryBadge({ category, active }: CategoryBadgeProps) {
  return (
    <Link
      href={`/blog/category/${slugify(category)}`}
      aria-current={active ? 'true' : undefined}
      className="inline-flex min-h-7 items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 font-mono text-[0.7rem] uppercase tracking-[0.06em] text-primary-light no-underline transition-colors hover:border-primary/50"
    >
      {category}
    </Link>
  )
}

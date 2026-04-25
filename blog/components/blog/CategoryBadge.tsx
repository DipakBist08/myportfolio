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
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all ${
        active
          ? 'border-accent/50 bg-accent/20 text-accent light:bg-cyan-100 light:border-cyan-300 light:text-cyan-700'
          : 'border-accent/25 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent/40 light:border-cyan-200 light:bg-cyan-50 light:text-cyan-700 light:hover:bg-cyan-100'
      }`}
    >
      {category}
    </Link>
  )
}

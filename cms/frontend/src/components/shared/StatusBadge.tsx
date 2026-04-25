import { cn, STATUS_COLORS } from '@/lib/utils'
import type { PostStatus } from '@/types'

export default function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      STATUS_COLORS[status]
    )}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

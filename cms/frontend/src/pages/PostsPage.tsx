import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus, Search, Filter, Trash2, Edit3, Eye, ArrowUpDown,
  MoreHorizontal, Calendar, Clock, Tag as TagIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StatusBadge from '@/components/shared/StatusBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { formatDate, formatRelative, truncate } from '@/lib/utils'
import api from '@/lib/api'
import type { PaginatedPosts, PostListItem, PostStatus } from '@/types'

const STATUSES: { label: string; value: PostStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Archived', value: 'archived' },
]

export default function PostsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PostStatus | ''>('')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [selected, setSelected] = useState<number[]>([])

  const { data, isLoading } = useQuery<PaginatedPosts>({
    queryKey: ['posts', page, status, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 }
      if (status) params.status = status
      if (search) params.search = search
      return (await api.get('/api/v1/posts', { params })).data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/posts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      toast.success('Post deleted')
      setDeleteId(null)
    },
    onError: () => toast.error('Delete failed'),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, s }: { ids: number[]; s: PostStatus }) =>
      api.post('/api/v1/posts/bulk/status', ids, { params: { new_status: s } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      toast.success('Posts updated')
      setSelected([])
    },
  })

  const toggleSelect = (id: number) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const toggleAll = () =>
    setSelected(p => p.length === (data?.items.length ?? 0) ? [] : (data?.items.map(i => i.id) ?? []))

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Posts</h1>
          <p className="text-sm text-slate-400">
            {data?.total ?? 0} total posts
          </p>
        </div>
        <Link to="/posts/new">
          <Button variant="gradient" size="sm">
            <Plus size={15} className="mr-1.5" />
            New Post
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search posts…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => { setStatus(s.value as PostStatus | ''); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  status === s.value
                    ? 'bg-primary/20 text-primary-light border border-primary/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <span className="text-xs text-slate-400">{selected.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulkStatusMutation.mutate({ ids: selected, s: 'published' })}>
              Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkStatusMutation.mutate({ ids: selected, s: 'archived' })}>
              Archive
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkStatusMutation.mutate({ ids: selected, s: 'draft' })}>
              Draft
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 text-left w-8">
                <input type="checkbox" className="accent-primary" checked={selected.length === (data?.items.length ?? 0) && selected.length > 0}
                  onChange={toggleAll} />
              </th>
              <th className="py-3 px-4 text-left">Title</th>
              <th className="py-3 px-4 text-left hidden md:table-cell">Status</th>
              <th className="py-3 px-4 text-left hidden lg:table-cell">Category</th>
              <th className="py-3 px-4 text-right hidden sm:table-cell">Views</th>
              <th className="py-3 px-4 text-right hidden lg:table-cell">Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="py-4 px-4"><div className="w-4 h-4 bg-white/5 rounded" /></td>
                <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-3/4 mb-1" /><div className="h-3 bg-white/5 rounded w-1/2" /></td>
                <td className="py-4 px-4 hidden md:table-cell"><div className="h-5 bg-white/5 rounded w-20" /></td>
                <td className="py-4 px-4 hidden lg:table-cell"><div className="h-4 bg-white/5 rounded w-24" /></td>
                <td className="py-4 px-4 hidden sm:table-cell text-right"><div className="h-4 bg-white/5 rounded w-12 ml-auto" /></td>
                <td className="py-4 px-4 hidden lg:table-cell text-right"><div className="h-4 bg-white/5 rounded w-20 ml-auto" /></td>
                <td className="py-4 px-4" />
              </tr>
            ))}
            {!isLoading && data?.items.map((post) => (
              <tr key={post.id} className="hover:bg-white/2 transition-colors group">
                <td className="py-3 px-4">
                  <input type="checkbox" className="accent-primary" checked={selected.includes(post.id)}
                    onChange={() => toggleSelect(post.id)} />
                </td>
                <td className="py-3 px-4">
                  <div>
                    <Link to={`/posts/${post.id}/edit`} className="text-sm font-medium text-slate-200 hover:text-primary group-hover:text-primary">
                      {post.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 font-mono">/{post.slug}</span>
                      {post.reading_time > 0 && (
                        <span className="text-xs text-slate-500 flex items-center gap-0.5">
                          <Clock size={10} />{post.reading_time}m
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <StatusBadge status={post.status} />
                </td>
                <td className="py-3 px-4 hidden lg:table-cell">
                  {post.category ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-2 h-2 rounded-full" style={{ background: post.category.color }} />
                      {post.category.name}
                    </span>
                  ) : <span className="text-xs text-slate-500">—</span>}
                </td>
                <td className="py-3 px-4 hidden sm:table-cell text-right text-xs text-slate-400">
                  {post.view_count.toLocaleString()}
                </td>
                <td className="py-3 px-4 hidden lg:table-cell text-right text-xs text-slate-400">
                  {post.published_at ? formatDate(post.published_at) : formatRelative(post.created_at)}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/posts/${post.id}/edit`} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
                      <Edit3 size={14} />
                    </Link>
                    <button onClick={() => setDeleteId(post.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  No posts found.{' '}
                  <Link to="/posts/new" className="text-primary hover:underline">Create your first post</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Page {data.page} of {data.pages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}>
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={o => !o && setDeleteId(null)}
        title="Delete post?"
        description="This will permanently delete the post and cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare, Trash2, CheckCircle, XCircle, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import api from '@/lib/api'
import type { Comment } from '@/types'

export default function CommentsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [approvedFilter, setApprovedFilter] = useState<'all' | 'approved' | 'pending'>('all')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const params: Record<string, string | boolean> = {}
  if (approvedFilter === 'approved') params.approved = true
  if (approvedFilter === 'pending') params.approved = false

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['comments', approvedFilter],
    queryFn: async () => (await api.get('/api/v1/comments', { params })).data,
  })

  const filtered = comments.filter(c =>
    !search ||
    c.author_name.toLowerCase().includes(search.toLowerCase()) ||
    c.author_email.toLowerCase().includes(search.toLowerCase()) ||
    c.content.toLowerCase().includes(search.toLowerCase()) ||
    c.post_slug.toLowerCase().includes(search.toLowerCase())
  )

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/v1/comments/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments'] })
      toast.success('Comment status updated')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/comments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments'] })
      toast.success('Comment deleted')
      setDeleteId(null)
    },
  })

  const toggleExpand = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const topLevel = filtered.filter(c => c.parent_id === null)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Comments</h1>
        <p className="text-sm text-slate-400">Moderate and manage blog post comments</p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, content or post…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {(['all', 'approved', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setApprovedFilter(f)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                approvedFilter === f
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: comments.length, color: 'text-primary' },
          { label: 'Approved', value: comments.filter(c => c.is_approved).length, color: 'text-green-400' },
          { label: 'Pending', value: comments.filter(c => !c.is_approved).length, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Comments list */}
      <div className="glass-card divide-y divide-border/50">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 animate-pulse space-y-2">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-white/10" />
                <div className="h-12 rounded bg-white/5" />
              </div>
            </div>
          </div>
        ))}

        {!isLoading && topLevel.length === 0 && (
          <div className="py-14 text-center text-slate-500">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            No comments found.
          </div>
        )}

        {topLevel.map(comment => {
          const isExpanded = expanded.has(comment.id)
          const replyCount = comment.replies?.length ?? 0

          return (
            <div key={comment.id} className="p-4">
              {/* Top-level comment */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary-light">
                  {comment.author_name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                    <span className="text-sm font-semibold text-slate-200">{comment.author_name}</span>
                    <span className="text-xs text-slate-500">{comment.author_email}</span>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">{formatDate(comment.created_at)}</span>
                    <span className="text-slate-700">·</span>
                    <a
                      href={`https://blog.dipakbist.com.np/blog/${comment.post_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-light hover:underline truncate max-w-[180px]"
                    >
                      {comment.post_slug}
                    </a>
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{comment.content}</p>

                  {/* Replies toggle */}
                  {replyCount > 0 && (
                    <button
                      onClick={() => toggleExpand(comment.id)}
                      className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {replyCount} repl{replyCount === 1 ? 'y' : 'ies'}
                    </button>
                  )}

                  {/* Replies */}
                  {isExpanded && comment.replies?.map(reply => (
                    <div key={reply.id} className="mt-3 ml-4 flex items-start gap-2 border-l-2 border-slate-700/30 pl-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                        {reply.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-300">{reply.author_name}</span>
                          <span className="text-xs text-slate-600">{formatDate(reply.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-400 whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
                    comment.is_approved
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  }`}>
                    {comment.is_approved ? 'Approved' : 'Pending'}
                  </span>
                  <button
                    title={comment.is_approved ? 'Unapprove' : 'Approve'}
                    onClick={() => toggleMutation.mutate(comment.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                  >
                    {comment.is_approved ? <XCircle size={14} /> : <CheckCircle size={14} />}
                  </button>
                  <button
                    title="Delete"
                    onClick={() => setDeleteId(comment.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={o => !o && setDeleteId(null)}
        title="Delete comment?"
        description="This will also delete all replies. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, Trash2, Users, UserCheck, UserX, Clock, Download, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StatCard from '@/components/shared/StatCard'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { formatDate } from '@/lib/utils'
import api from '@/lib/api'
import type { Subscriber, SubscriberStats } from '@/types'

interface NewsletterResult { sent: number; failed: number; errors: string[] }

export default function SubscribersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Newsletter compose state
  const [showCompose, setShowCompose] = useState(false)
  const [nlSubject, setNlSubject] = useState('')
  const [nlBody, setNlBody] = useState('')
  const [nlResult, setNlResult] = useState<NewsletterResult | null>(null)

  const { data: stats } = useQuery<SubscriberStats>({
    queryKey: ['subscriber-stats'],
    queryFn: async () => (await api.get('/api/v1/subscribers/stats')).data,
  })

  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ['subscribers', page, search, activeOnly],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page, page_size: 50 }
      if (search) params.search = search
      if (activeOnly) params.active_only = true
      return (await api.get('/api/v1/subscribers', { params })).data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/subscribers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscribers'] })
      qc.invalidateQueries({ queryKey: ['subscriber-stats'] })
      toast.success('Subscriber removed')
      setDeleteId(null)
    },
  })

  const sendMutation = useMutation({
    mutationFn: () =>
      api.post<NewsletterResult>('/api/v1/subscribers/send-newsletter', {
        subject: nlSubject,
        content_html: nlBody,
      }),
    onSuccess: ({ data }) => {
      setNlResult(data)
      toast.success(`Newsletter sent to ${data.sent} subscriber${data.sent !== 1 ? 's' : ''}`)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to send newsletter')
    },
  })

  const exportCSV = () => {
    const rows = [
      ['Email', 'Name', 'Status', 'Subscribed At', 'Confirmed At'],
      ...subscribers.map(s => [
        s.email, s.name,
        s.is_unsubscribed ? 'Unsubscribed' : s.is_active ? 'Active' : 'Pending',
        s.subscribed_at, s.confirmed_at ?? '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    a.download = 'subscribers.csv'
    a.click()
  }

  const activeCount = stats?.active ?? 0

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Subscribers</h1>
          <p className="text-sm text-slate-400">Newsletter subscriber management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download size={14} className="mr-1.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => { setShowCompose(true); setNlResult(null) }} disabled={activeCount === 0}>
            <Send size={14} className="mr-1.5" /> Send Newsletter
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Total" value={stats.total} icon={Users} iconColor="text-primary" />
          <StatCard title="Confirmed" value={stats.active} icon={UserCheck} iconColor="text-success" />
          <StatCard title="Pending" value={stats.pending} icon={Clock} iconColor="text-warning" />
          <StatCard title="Unsubscribed" value={stats.unsubscribed} icon={UserX} iconColor="text-destructive" />
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by email or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" className="accent-primary" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
          Active only
        </label>
      </div>

      {/* Subscriber table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left hidden md:table-cell">Name</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-left hidden lg:table-cell">Subscribed</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {[...Array(5)].map((__, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-white/5 rounded" /></td>)}
              </tr>
            ))}
            {subscribers.map(sub => (
              <tr key={sub.id} className="hover:bg-white/2 transition-colors">
                <td className="py-3 px-4 text-sm text-slate-200">{sub.email}</td>
                <td className="py-3 px-4 text-sm text-slate-400 hidden md:table-cell">{sub.name || '—'}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    sub.is_unsubscribed
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : sub.is_active
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }`}>
                    {sub.is_unsubscribed ? 'Unsubscribed' : sub.is_active ? 'Active' : 'Pending'}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-slate-400 hidden lg:table-cell">
                  {formatDate(sub.subscribed_at)}
                </td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => setDeleteId(sub.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && subscribers.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-500">No subscribers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={o => !o && setDeleteId(null)}
        title="Remove subscriber?"
        description="The subscriber will be permanently removed."
        confirmLabel="Remove"
        destructive
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      {/* ── Send Newsletter Modal ─────────────────────────────────────────── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface-card shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-heading font-semibold text-white">Send Newsletter</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Will be sent to <span className="text-primary-light font-medium">{activeCount} confirmed</span> subscriber{activeCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setShowCompose(false)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>

            {nlResult ? (
              /* ── Result screen ── */
              <div className="p-6 text-center space-y-3">
                <div className={`text-4xl ${nlResult.failed === 0 ? '' : 'opacity-80'}`}>
                  {nlResult.failed === 0 ? '🎉' : '⚠️'}
                </div>
                <p className="text-slate-200 font-medium">
                  Sent to <span className="text-green-400">{nlResult.sent}</span> subscriber{nlResult.sent !== 1 ? 's' : ''}
                  {nlResult.failed > 0 && (
                    <>, <span className="text-red-400">{nlResult.failed} failed</span></>
                  )}
                </p>
                {nlResult.errors.length > 0 && (
                  <ul className="text-xs text-red-400 text-left space-y-1 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                    {nlResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
                <Button className="mt-2" onClick={() => { setShowCompose(false); setNlSubject(''); setNlBody('') }}>
                  Done
                </Button>
              </div>
            ) : (
              /* ── Compose screen ── */
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Subject line</label>
                  <Input
                    placeholder="e.g. New article: How to write better bug reports"
                    value={nlSubject}
                    onChange={e => setNlSubject(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                    Email body <span className="text-slate-600">(HTML supported)</span>
                  </label>
                  <textarea
                    rows={12}
                    placeholder={`<h2>New article is live! 🚀</h2>\n<p>Hi,</p>\n<p>I just published a new article on...</p>\n<p><a href="https://blog.dipakbist.com.np/blog/your-post-slug">Read it here →</a></p>`}
                    value={nlBody}
                    onChange={e => setNlBody(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white/5 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 font-mono resize-y"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
                  <Button
                    onClick={() => sendMutation.mutate()}
                    disabled={!nlSubject.trim() || !nlBody.trim() || sendMutation.isPending}
                  >
                    <Send size={14} className="mr-1.5" />
                    {sendMutation.isPending ? `Sending to ${activeCount}…` : `Send to ${activeCount} subscriber${activeCount !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, Trash2, Users, UserCheck, UserX, Clock, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StatCard from '@/components/shared/StatCard'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { formatDate } from '@/lib/utils'
import api from '@/lib/api'
import type { Subscriber, SubscriberStats } from '@/types'

export default function SubscribersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<number | null>(null)

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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Subscribers</h1>
          <p className="text-sm text-slate-400">Newsletter subscriber management</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
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

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left hidden md:table-cell">Name</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-left hidden lg:table-cell">Date</th>
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

      <ConfirmDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}
        title="Remove subscriber?" description="The subscriber will be permanently removed."
        confirmLabel="Remove" destructive onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} />
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { FileText, Eye, Users, Tag, TrendingUp, Clock, Star } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { formatDate, formatRelative } from '@/lib/utils'
import api from '@/lib/api'
import type { DashboardStats } from '@/types'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get('/api/v1/analytics/dashboard')).data,
    refetchInterval: 30_000,
  })

  if (isError) return (
    <div className="glass-card p-6 text-center text-slate-400 text-sm">
      Failed to load dashboard stats. Please refresh the page.
    </div>
  )

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass-card p-5 animate-pulse">
          <div className="w-10 h-10 bg-white/5 rounded-xl mb-3" />
          <div className="h-7 bg-white/5 rounded w-16 mb-2" />
          <div className="h-4 bg-white/5 rounded w-24" />
        </div>
      ))}
    </div>
  )

  if (!stats) return null

  const s = stats

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Your blog's performance at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Posts"
          value={s.total_posts}
          subtitle={`${s.published_posts} published · ${s.draft_posts} drafts`}
          icon={FileText}
          iconColor="text-primary"
        />
        <StatCard
          title="Total Views"
          value={s.total_views.toLocaleString()}
          icon={Eye}
          iconColor="text-accent"
        />
        <StatCard
          title="Subscribers"
          value={s.total_subscribers}
          subtitle={`+${s.new_subscribers_30d} last 30 days`}
          icon={Users}
          iconColor="text-secondary"
          trend={{ value: s.new_subscribers_30d, label: 'this month' }}
        />
        <StatCard
          title="Categories"
          value={s.total_categories}
          subtitle={`${s.total_tags} tags`}
          icon={Tag}
          iconColor="text-success"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Views chart */}
        <div className="xl:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Views (Last 7 days)
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={s.views_chart}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', fontSize: 12 }}
                labelStyle={{ color: '#f1f5f9' }}
                itemStyle={{ color: '#818cf8' }}
              />
              <Area type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} fill="url(#colorViews)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top posts */}
        <div className="glass-card p-5">
          <h2 className="font-heading font-semibold text-white flex items-center gap-2 mb-4">
            <Star size={16} className="text-yellow-400" />
            Top Posts
          </h2>
          <div className="space-y-3">
            {s.top_posts.length === 0 && (
              <p className="text-sm text-slate-500">No published posts yet.</p>
            )}
            {s.top_posts.map((p, i) => (
              <div key={p.id} className="flex items-start gap-3">
                <span className="text-xs font-mono text-slate-500 mt-0.5 w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <Link to={`/posts/${p.id}/edit`} className="text-sm text-slate-200 hover:text-primary truncate block">
                    {p.title}
                  </Link>
                  <span className="text-xs text-slate-500">{p.views.toLocaleString()} views</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent posts */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-accent" />
            Recent Posts
          </h2>
          <Link to="/posts" className="text-sm text-primary hover:text-primary-light">View all →</Link>
        </div>
        <div className="space-y-2">
          {s.recent_posts.length === 0 && (
            <p className="text-sm text-slate-500">No posts yet. <Link to="/posts/new" className="text-primary hover:underline">Create your first post →</Link></p>
          )}
          {s.recent_posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <Link to={`/posts/${p.id}/edit`} className="text-sm text-slate-200 hover:text-primary">
                {p.title}
              </Link>
              <span className="text-xs text-slate-500">{p.views} views</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

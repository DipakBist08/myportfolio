import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Eye, Globe, CalendarDays, BookOpen, ThumbsUp, ThumbsDown, MessageSquare, ExternalLink } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import StatCard from '@/components/shared/StatCard'
import api from '@/lib/api'
import type { TrafficStats } from '@/types'

const PERIODS = [7, 30, 90] as const
const BLOG = 'https://blog.dipakbist.com.np'
const PORTFOLIO = 'https://dipakbist.com.np'
const n = (v: number) => v.toLocaleString()

/** Visitors and page views for the portfolio and the blog, per day in the
 *  admin's own time zone, plus how each blog post is read and received. */
export default function TrafficPanel() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const tzOffset = -new Date().getTimezoneOffset()

  const { data: t, isLoading, isError } = useQuery<TrafficStats>({
    queryKey: ['traffic', days, tzOffset],
    queryFn: async () => (await api.get('/api/v1/analytics/traffic', { params: { days, tz_offset: tzOffset } })).data,
    refetchInterval: 60_000,
  })

  const site = (name: 'portfolio' | 'blog') => t?.by_site.find(s => s.site === name) ?? { visits: 0, visitors: 0 }

  return (
    <section aria-labelledby="traffic-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="traffic-heading" className="text-lg font-heading font-semibold text-white flex items-center gap-2">
            <Globe size={18} className="text-accent" />
            Website traffic
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            dipakbist.com.np and blog.dipakbist.com.np. A visitor is one person (counted without cookies);
            a view is one page they opened. Reloads within 30 minutes count once, and crawlers are not counted.
          </p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-sm" role="group" aria-label="Period">
          {PERIODS.map(p => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setDays(p)}
              className={`px-3 py-1.5 transition-colors ${days === p ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {p} days
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="glass-card p-5 text-sm text-slate-400">Couldn't load traffic. It refreshes every minute.</div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse h-[132px]" />
          ))}
        </div>
      )}

      {t && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Visitors today" value={n(t.visitors_today)} subtitle={`${n(t.visits_today)} page views`} icon={CalendarDays} iconColor="text-primary" />
            <StatCard title={`Visitors, last ${t.days} days`} value={n(t.visitors_period)} subtitle={`${n(t.visits_period)} page views`} icon={Users} iconColor="text-accent" />
            <StatCard title="Visitors, all time" value={n(t.visitors_total)} subtitle={`${n(t.visits_total)} page views`} icon={Eye} iconColor="text-secondary" />
            <StatCard
              title={`By site, last ${t.days} days`}
              value={`${n(site('portfolio').visitors)} · ${n(site('blog').visitors)}`}
              subtitle="portfolio · blog visitors"
              icon={Globe}
              iconColor="text-success"
            />
          </div>

          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-white mb-4">Visitors and page views per day</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={t.chart}>
                <defs>
                  <linearGradient id="trafficVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="trafficVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={16} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', fontSize: 12 }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" name="Page views" dataKey="visits" stroke="#22d3ee" strokeWidth={2} fill="url(#trafficVisits)" />
                <Area type="monotone" name="Visitors" dataKey="visitors" stroke="#6366f1" strokeWidth={2} fill="url(#trafficVisitors)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 glass-card p-5 overflow-x-auto">
              <h3 className="font-heading font-semibold text-white mb-1 flex items-center gap-2">
                <BookOpen size={16} className="text-primary" />
                Blog posts
              </h3>
              <p className="text-xs text-slate-500 mb-4">All time. Readers are the people who opened the post.</p>
              {t.posts.length === 0 ? (
                <p className="text-sm text-slate-500">No post has been read or commented on yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-border/50">
                      <th scope="col" className="py-2 pr-3 font-medium">Post</th>
                      <th scope="col" className="py-2 px-2 font-medium text-right">Views</th>
                      <th scope="col" className="py-2 px-2 font-medium text-right">Readers</th>
                      <th scope="col" className="py-2 px-2 font-medium text-right"><MessageSquare size={13} className="inline" aria-label="Comments" /></th>
                      <th scope="col" className="py-2 px-2 font-medium text-right"><ThumbsUp size={13} className="inline" aria-label="Likes on comments" /></th>
                      <th scope="col" className="py-2 pl-2 font-medium text-right"><ThumbsDown size={13} className="inline" aria-label="Dislikes on comments" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.posts.map(p => (
                      <tr key={p.slug} className="border-b border-border/30 last:border-0">
                        <td className="py-2 pr-3 max-w-[22rem]">
                          <a href={`${BLOG}/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                            className="text-slate-200 hover:text-primary inline-flex items-center gap-1 truncate max-w-full">
                            <span className="truncate">{p.title || p.slug}</span>
                            <ExternalLink size={11} className="shrink-0 opacity-50" />
                          </a>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-300">{n(p.views)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-300">{n(p.readers)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-400">{n(p.comments)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-green-400">{n(p.likes)}</td>
                        <td className="py-2 pl-2 text-right tabular-nums text-red-400">{n(p.dislikes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-card p-5">
              <h3 className="font-heading font-semibold text-white mb-1">Top pages</h3>
              <p className="text-xs text-slate-500 mb-4">Last {t.days} days</p>
              {t.top_pages.length === 0 ? (
                <p className="text-sm text-slate-500">No visits yet.</p>
              ) : (
                <ol className="space-y-2.5">
                  {t.top_pages.map(p => (
                    <li key={`${p.site}${p.path}`} className="flex items-start justify-between gap-3 text-sm">
                      <a href={`${p.site === 'blog' ? BLOG : PORTFOLIO}${p.path}`} target="_blank" rel="noopener noreferrer"
                        className="min-w-0 text-slate-200 hover:text-primary">
                        <span className="block truncate">{p.title || p.path}</span>
                        <span className="block text-xs text-slate-500 truncate">{p.site} · {p.path}</span>
                      </a>
                      <span className="shrink-0 text-right text-xs text-slate-400 tabular-nums">
                        {n(p.visitors)} visitors<br />{n(p.visits)} views
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

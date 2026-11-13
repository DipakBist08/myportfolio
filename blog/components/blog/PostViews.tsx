'use client'

import { useEffect, useState } from 'react'
import { API_URL, TEXT, TRACK_URL, shouldCount, visitBody } from './visits'

type Stats = { views: number; readers: number }

/** "Seen by N readers": counts this reader's visit to the post (once per 30
 *  minutes) and shows how many people have opened it. If the reader's browser
 *  asks not to be tracked, it only reads the number. Shows nothing until the
 *  number arrives, or if the API can't be reached. */
export default function PostViews({ slug, title }: { slug: string; title: string }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let alive = true
    const request = shouldCount()
      ? fetch(TRACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': TEXT },
          body: visitBody({ site: 'blog', path: `/blog/${slug}`, slug, title, referrer: document.referrer }),
          keepalive: true,
        })
      : fetch(`${API_URL}/api/public/stats/post?slug=${encodeURIComponent(slug)}`)
    request
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data && typeof data.readers === 'number') setStats({ views: data.views, readers: data.readers })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [slug, title])

  if (!stats || stats.readers < 1) return null
  return (
    <span className="inline-flex items-center gap-1.5" title={`${stats.views.toLocaleString()} views in all`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Seen by {stats.readers.toLocaleString()} {stats.readers === 1 ? 'reader' : 'readers'}
    </span>
  )
}

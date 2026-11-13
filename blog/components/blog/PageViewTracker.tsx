'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { POST_PATH, TEXT, TRACK_URL, shouldCount, visitBody } from './visits'

/** Counts a visit to every blog page except posts (which count themselves in
 *  PostViews, so they can show their readers). Renders nothing, adds no
 *  third-party script: one small beacon per page. */
export default function PageViewTracker() {
  const path = usePathname()

  useEffect(() => {
    if (!path || POST_PATH.test(path) || !shouldCount()) return
    const body = visitBody({ site: 'blog', path, title: document.title, referrer: document.referrer })
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(TRACK_URL, new Blob([body], { type: TEXT }))) return
    } catch {
      // fall through to fetch
    }
    fetch(TRACK_URL, { method: 'POST', body, headers: { 'Content-Type': TEXT }, keepalive: true }).catch(() => {})
  }, [path])

  return null
}

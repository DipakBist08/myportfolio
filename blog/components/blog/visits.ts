/* Visit counting for the blog, against the CMS API (/api/public/track).
   No cookies or storage: the API counts a visitor by a keyed hash of their
   connection and browser, and keeps no IP address. */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.dipakbist.com.np'
export const TRACK_URL = `${API_URL}/api/public/track`

const isLocal = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]'

/** False for previews on this machine against the live API (they would skew
 *  the real numbers) and when the browser asks not to be tracked. */
export function shouldCount(): boolean {
  if (typeof window === 'undefined') return false
  let apiHost = ''
  try { apiHost = new URL(API_URL).hostname } catch { return false }
  if (isLocal(window.location.hostname) && !isLocal(apiHost)) return false
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return !(nav.doNotTrack === '1' || nav.globalPrivacyControl === true)
}

export type VisitBody = { site: 'blog'; path: string; slug?: string; title: string; referrer: string }

/** text/plain keeps it a simple request: no CORS preflight. */
export const visitBody = (body: VisitBody) => JSON.stringify(body)
export const TEXT = 'text/plain;charset=UTF-8'

/** Blog post pages count themselves (PostViews); everything else is counted by PageViewTracker. */
export const POST_PATH = /^\/blog\/(?!category\/|tag\/)[^/]+\/?$/

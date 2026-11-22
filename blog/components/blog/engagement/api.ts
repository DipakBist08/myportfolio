/* Calls to the CMS API for signed-in readers: claps, responses, sign-in.
   The reader's session is an httpOnly cookie on the API's domain, so every
   call sends credentials; the page itself never sees the session. */

import { API_URL } from '../visits'

export { API_URL }

/** The Google OAuth client ID, if built in. Optional: when it is empty the blog uses the
 *  API's GOOGLE_CLIENT_ID from /api/public/auth/me (ReaderContext), so Render's setting alone
 *  switches sign-in on. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export type Reader = { id: number; name: string; picture: string }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function messageFrom(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  if (status === 429) return 'Too many tries. Please wait a minute.'
  return 'Something went wrong. Please try again.'
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch {
    throw new ApiError('Could not connect. Please try again.', 0)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status)
  return data as T
}

/** "1.2K" style counts, as on Medium. */
export function compactCount(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from './api'
import { useReader } from './ReaderContext'

type ClapSummary = { slug: string; claps: number; clappers: number; my_claps: number; max_claps: number }

interface EngagementState {
  /** Total claps for the post; null until the API answers (or if it can't be reached). */
  claps: number | null
  myClaps: number
  maxClaps: number
  /** Responses (comments and replies), reported by the responses section. */
  responses: number | null
  setResponses: (n: number) => void
  /** One clap. Asks the reader to sign in first if needed. Returns false at the limit. */
  clap: () => boolean
  undo: () => Promise<void>
  error: string
}

const EngagementContext = createContext<EngagementState | null>(null)

export function usePostEngagement(): EngagementState {
  const value = useContext(EngagementContext)
  if (!value) throw new Error('usePostEngagement must be used inside <PostEngagementProvider>')
  return value
}

const FLUSH_AFTER_MS = 600

/** Claps and the response count for one post, shared by the clap bars at the
 *  top and bottom of the article. A burst of claps is sent as one request once
 *  the reader pauses; the numbers change at once and are corrected by the
 *  API's answer (or rolled back if it fails). */
export function PostEngagementProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { reader, requireSignIn, sessionExpired } = useReader()
  const [summary, setSummary] = useState<ClapSummary | null>(null)
  const [unsent, setUnsent] = useState(0)
  const [responses, setResponses] = useState<number | null>(null)
  const [error, setError] = useState('')
  const pendingRef = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxClaps = summary?.max_claps ?? 50
  const myClaps = (summary?.my_claps ?? 0) + unsent

  // Load the totals, and again when the reader signs in or out (their own claps).
  useEffect(() => {
    let alive = true
    api<ClapSummary>(`/api/public/claps?slug=${encodeURIComponent(slug)}`)
      .then((data) => alive && setSummary(data))
      .catch(() => {})
    return () => { alive = false }
  }, [slug, reader?.id])

  const flush = useCallback(async () => {
    timer.current = null
    const count = pendingRef.current
    if (count < 1) return
    pendingRef.current = 0
    try {
      const data = await api<ClapSummary>('/api/public/claps', { method: 'POST', body: JSON.stringify({ slug, count }) })
      setSummary(data)
      setUnsent(pendingRef.current) // claps made while this request was out
    } catch (err) {
      setUnsent(pendingRef.current)
      if (err instanceof ApiError && err.status === 401) {
        sessionExpired('clap')
        return
      }
      setError(err instanceof Error ? err.message : 'Could not save your claps.')
    }
  }, [slug, sessionExpired])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const addOne = useCallback(() => {
    setError('')
    pendingRef.current += 1
    setUnsent((n) => n + 1)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, FLUSH_AFTER_MS)
  }, [flush])

  const clap = useCallback(() => {
    if (!reader) {
      requireSignIn('clap', addOne)
      return true
    }
    if (myClaps >= maxClaps) return false
    addOne()
    return true
  }, [reader, requireSignIn, addOne, myClaps, maxClaps])

  const undo = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pendingRef.current = 0
    setUnsent(0)
    setError('')
    try {
      setSummary(await api<ClapSummary>(`/api/public/claps?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' }))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return sessionExpired('clap')
      setError(err instanceof Error ? err.message : 'Could not undo your claps.')
    }
  }, [slug, sessionExpired])

  const value = useMemo<EngagementState>(() => ({
    claps: summary ? summary.claps + unsent : null,
    myClaps,
    maxClaps,
    responses,
    setResponses,
    clap,
    undo,
    error,
  }), [summary, unsent, myClaps, maxClaps, responses, clap, undo, error])

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>
}

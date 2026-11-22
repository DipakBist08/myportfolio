'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from './api'
import { useReader } from './ReaderContext'

type ClapSummary = { slug: string; claps: number; clappers: number; my_claps: number; max_claps: number }

interface EngagementState {
  /** Readers who clapped for the post; null until the API answers (or if it can't be reached). */
  claps: number | null
  /** Whether this reader has clapped (one clap per reader). */
  clapped: boolean
  /** Responses (comments and replies), reported by the responses section. */
  responses: number | null
  setResponses: (n: number) => void
  /** Clap, or take the clap back. Asks the reader to sign in first if needed. */
  toggleClap: () => void
  error: string
}

const EngagementContext = createContext<EngagementState | null>(null)

export function usePostEngagement(): EngagementState {
  const value = useContext(EngagementContext)
  if (!value) throw new Error('usePostEngagement must be used inside <PostEngagementProvider>')
  return value
}

const SEND_AFTER_MS = 300

/** Claps and the response count for one post, shared by the clap bars at the
 *  top and bottom of the article. One clap per reader (the owner's rule,
 *  22/11/2026): the button claps, and pressing it again takes the clap back.
 *  The button changes at once; the reader's last choice is sent once they
 *  stop pressing, one request at a time, so quick presses can't count twice
 *  or arrive out of order. A failed request rolls back to the API's state. */
export function PostEngagementProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { reader, requireSignIn, sessionExpired } = useReader()
  const [summary, setSummary] = useState<ClapSummary | null>(null)
  /** The reader's choice while it is not yet confirmed by the API. */
  const [wanted, setWanted] = useState<boolean | null>(null)
  const [responses, setResponses] = useState<number | null>(null)
  const [error, setError] = useState('')
  const wantedRef = useRef<boolean | null>(null)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedClap = (summary?.my_claps ?? 0) > 0
  const clapped = wanted ?? savedClap

  // Load the totals, and again when the reader signs in or out (their own claps).
  useEffect(() => {
    let alive = true
    api<ClapSummary>(`/api/public/claps?slug=${encodeURIComponent(slug)}`)
      .then((data) => alive && setSummary(data))
      .catch(() => {})
    return () => { alive = false }
  }, [slug, reader?.id])

  /* Sends the reader's latest choice: a clap (POST) or taking it back
     (DELETE). Only one request is out at a time; a choice made meanwhile is
     sent when it returns. */
  const send: () => Promise<void> = useCallback(async () => {
    timer.current = null
    const want = wantedRef.current
    if (want === null || inFlight.current) return
    inFlight.current = true
    try {
      const data = want
        ? await api<ClapSummary>('/api/public/claps', { method: 'POST', body: JSON.stringify({ slug }) })
        : await api<ClapSummary>(`/api/public/claps?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' })
      setSummary(data)
      if (wantedRef.current === want) {
        wantedRef.current = null
        setWanted(null)
      }
    } catch (err) {
      wantedRef.current = null
      setWanted(null)
      if (err instanceof ApiError && err.status === 401) sessionExpired('clap')
      else setError(err instanceof Error ? err.message : 'Could not save your clap.')
    } finally {
      inFlight.current = false
    }
    if (wantedRef.current !== null && !timer.current) void send()
  }, [slug, sessionExpired])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const choose = useCallback((want: boolean) => {
    setError('')
    wantedRef.current = want
    setWanted(want)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void send() }, SEND_AFTER_MS)
  }, [send])

  const toggleClap = useCallback(() => {
    if (!reader) {
      requireSignIn('clap', () => choose(true))
      return
    }
    choose(!clapped)
  }, [reader, requireSignIn, choose, clapped])

  // The total shown includes the reader's unconfirmed choice.
  const claps = summary ? summary.claps - (savedClap ? 1 : 0) + (clapped ? 1 : 0) : null

  const value = useMemo<EngagementState>(() => ({
    claps,
    clapped,
    responses,
    setResponses,
    toggleClap,
    error,
  }), [claps, clapped, responses, toggleClap, error])

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>
}

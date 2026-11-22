'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, GOOGLE_CLIENT_ID, type Reader } from './api'
import SignInDialog from './SignInDialog'

type Reason = 'clap' | 'respond' | 'reply'

interface ReaderState {
  /** The signed-in reader, or null. */
  reader: Reader | null
  /** False until the API has said whether someone is signed in. */
  ready: boolean
  /** False when Google sign-in is not set up (no client ID here or on the API). */
  available: boolean
  /** True when the API could not be reached, so sign-in's state is unknown. */
  unreachable: boolean
  /** Run `then` now if signed in; otherwise ask the reader to sign in and run it after. */
  requireSignIn: (reason: Reason, then?: () => void) => void
  /** The session ended on the API (a 401): forget the reader and ask again. */
  sessionExpired: (reason: Reason, then?: () => void) => void
  signOut: () => Promise<void>
}

const ReaderContext = createContext<ReaderState | null>(null)

export function useReader(): ReaderState {
  const value = useContext(ReaderContext)
  if (!value) throw new Error('useReader must be used inside <ReaderProvider>')
  return value
}

/** Who is reading: signed in with Google or not. Wraps a post page so the clap
 *  buttons and the responses share one sign-in and one dialog. */
export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [reader, setReader] = useState<Reader | null>(null)
  const [ready, setReady] = useState(false)
  // The Google client ID: built in (NEXT_PUBLIC_GOOGLE_CLIENT_ID) or, if not,
  // the one the API uses, so the blog and the API always agree on sign-in.
  const [clientId, setClientId] = useState(GOOGLE_CLIENT_ID)
  const [available, setAvailable] = useState(Boolean(GOOGLE_CLIENT_ID))
  const [unreachable, setUnreachable] = useState(false)
  const [dialog, setDialog] = useState<Reason | null>(null)
  const pending = useRef<(() => void) | null>(null)

  useEffect(() => {
    let alive = true
    api<{ reader: Reader | null; sign_in: boolean; google_client_id?: string | null }>('/api/public/auth/me')
      .then((data) => {
        if (!alive) return
        const id = GOOGLE_CLIENT_ID || data.google_client_id || ''
        setReader(data.reader)
        setClientId(id)
        setAvailable(Boolean(id) && data.sign_in)
      })
      .catch(() => { if (alive) setUnreachable(true) })
      .finally(() => alive && setReady(true))
    return () => { alive = false }
  }, [])

  const requireSignIn = useCallback((reason: Reason, then?: () => void) => {
    if (reader) {
      then?.()
      return
    }
    pending.current = then ?? null
    setDialog(reason)
  }, [reader])

  const sessionExpired = useCallback((reason: Reason, then?: () => void) => {
    setReader(null)
    pending.current = then ?? null
    setDialog(reason)
  }, [])

  const signOut = useCallback(async () => {
    await api('/api/public/auth/logout', { method: 'POST' }).catch(() => {})
    setReader(null)
  }, [])

  const onSignedIn = useCallback((signedIn: Reader) => {
    setReader(signedIn)
    setDialog(null)
    const then = pending.current
    pending.current = null
    // After React has the reader, so the action sees the signed-in state.
    if (then) setTimeout(then, 0)
  }, [])

  const onClose = useCallback(() => {
    pending.current = null
    setDialog(null)
  }, [])

  const value = useMemo(
    () => ({ reader, ready, available, unreachable, requireSignIn, sessionExpired, signOut }),
    [reader, ready, available, unreachable, requireSignIn, sessionExpired, signOut],
  )

  return (
    <ReaderContext.Provider value={value}>
      {children}
      <SignInDialog reason={dialog} available={available} clientId={clientId} onSignedIn={onSignedIn} onClose={onClose} />
    </ReaderContext.Provider>
  )
}

'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.dipakbist.com.np'

type State = 'idle' | 'loading' | 'success' | 'error' | 'already'

interface Props {
  /** compact = inline footer strip, default = card on blog post */
  compact?: boolean
}

export default function NewsletterForm({ compact = false }: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setState('loading')
    try {
      const res = await fetch(`${API_URL}/api/v1/subscribers/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json()

      if (res.status === 429) {
        setState('error')
        setMessage('Too many requests — please wait a minute and try again.')
        return
      }
      if (!res.ok) {
        setState('error')
        setMessage(data.detail ?? 'Something went wrong. Please try again.')
        return
      }

      const detail: string = data.detail ?? ''
      if (detail.toLowerCase().includes('already')) {
        setState('already')
        setMessage('You are already subscribed.')
      } else {
        setState('success')
        setMessage("You're subscribed. Welcome to the list.")
        setEmail('')
      }
    } catch {
      setState('error')
      setMessage('Could not connect. Please try again later.')
    }
  }

  // ── Compact / footer variant ────────────────────────────────────────────────
  if (compact) {
    return (
      <div>
        {state === 'success' ? (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <span>You're subscribed. Welcome to the list.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setState('idle') }}
              placeholder="name@example.com"
              disabled={state === 'loading'}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-card px-3 text-base text-ink placeholder:text-subtle outline-none focus:border-primary disabled:opacity-50 light:bg-white"
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="btn btn-primary shrink-0"
            >
              {state === 'loading' ? '…' : 'Subscribe'}
            </button>
          </form>
        )}
        {(state === 'error' || state === 'already') && (
          <p className={`mt-1.5 text-xs ${state === 'already' ? 'text-muted' : 'text-red-400 light:text-red-700'}`}>
            {message}
          </p>
        )}
        {state !== 'success' && (
          <p className="mt-1.5 text-xs text-muted">One email per new article. Unsubscribe any time.</p>
        )}
      </div>
    )
  }

  // ── Default / blog post card variant ───────────────────────────────────────
  return (
    <div className="mt-12 rounded-xl border border-line p-6">
      <h3 className="mb-1 text-xl font-semibold text-ink">Stay Updated</h3>
      <p className="mb-4 text-sm text-muted">Get new QA articles delivered straight to your inbox.</p>

      {state === 'success' ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-green-400">{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setState('idle') }}
            placeholder="name@example.com"
            disabled={state === 'loading'}
            className="min-h-11 rounded-lg border border-line-strong bg-surface-card px-4 text-base text-ink placeholder:text-subtle outline-none focus:border-primary disabled:opacity-50 sm:w-72 light:bg-white"
          />
          <button
            type="submit"
            disabled={state === 'loading'}
            className="btn btn-primary"
          >
            {state === 'loading' ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
      )}

      {(state === 'error' || state === 'already') && (
        <p className={`mt-2 text-xs ${state === 'already' ? 'text-muted' : 'text-red-400 light:text-red-700'}`}>
          {message}
        </p>
      )}

      {state !== 'success' && (
        <p className="mt-2 text-xs text-muted">One email per new article. Unsubscribe any time.</p>
      )}
    </div>
  )
}

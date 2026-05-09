'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.dipakbist.com.np'

type State = 'idle' | 'loading' | 'success' | 'error' | 'already'

export default function NewsletterForm() {
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
        setMessage('You are already subscribed!')
      } else {
        setState('success')
        setMessage('Check your inbox to confirm your subscription.')
        setEmail('')
      }
    } catch {
      setState('error')
      setMessage('Could not connect. Please try again later.')
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
      <h3 className="mb-1 font-heading text-lg font-bold text-slate-100 light:text-slate-900">
        Stay Updated
      </h3>
      <p className="mb-4 text-sm text-slate-400">
        Get new QA articles delivered straight to your inbox.
      </p>

      {state === 'success' ? (
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl">📬</span>
          <p className="text-sm font-medium text-green-400">{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setState('idle') }}
            placeholder="your@email.com"
            disabled={state === 'loading'}
            className="rounded-lg border border-slate-700/50 bg-surface-card px-4 py-2 text-sm text-slate-300 placeholder-slate-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 sm:w-64 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={state === 'loading'}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state === 'loading' ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
      )}

      {(state === 'error' || state === 'already') && (
        <p className={`mt-2 text-xs ${state === 'already' ? 'text-yellow-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      {state !== 'success' && (
        <p className="mt-2 text-xs text-slate-600">No spam, unsubscribe anytime.</p>
      )}
    </div>
  )
}

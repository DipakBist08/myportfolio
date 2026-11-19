'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { api, GOOGLE_CLIENT_ID, type Reader } from './api'

/* Google Identity Services ("Sign in with Google"). The script is loaded only
   when this dialog opens, so readers who never sign in never contact Google. */
const GSI_SRC = 'https://accounts.google.com/gsi/client'

type GsiButtonOptions = {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
}

type Gsi = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: { credential?: string }) => void
        ux_mode?: 'popup' | 'redirect'
        context?: 'signin' | 'signup' | 'use'
        itp_support?: boolean
        use_fedcm_for_button?: boolean
      }) => void
      renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void
    }
  }
}

declare global {
  interface Window {
    google?: Gsi
  }
}

let gsiLoading: Promise<Gsi> | null = null

function loadGsi(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (!gsiLoading) {
    gsiLoading = new Promise<Gsi>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GSI_SRC
      script.async = true
      script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('no gsi')))
      script.onerror = () => {
        gsiLoading = null
        script.remove()
        reject(new Error('blocked'))
      }
      document.head.appendChild(script)
    })
  }
  return gsiLoading
}

const TITLES = {
  clap: 'Sign in to clap',
  respond: 'Sign in to respond',
  reply: 'Sign in to reply',
} as const

interface Props {
  reason: keyof typeof TITLES | null
  available: boolean
  onSignedIn: (reader: Reader) => void
  onClose: () => void
}

/** The sign-in dialog: Google's own button, what the blog keeps, and Close. */
export default function SignInDialog({ reason, available, onSignedIn, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'signing-in' | 'error'>('loading')
  const [error, setError] = useState('')
  // Google calls the callback given at initialize time; keep it pointing at the latest props.
  const signedInRef = useRef(onSignedIn)
  signedInRef.current = onSignedIn

  const open = reason !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open || !available || !GOOGLE_CLIENT_ID) return
    let alive = true
    setState('loading')
    setError('')
    loadGsi()
      .then((gsi) => {
        if (!alive || !buttonRef.current) return
        gsi.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          context: 'signin',
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            if (!credential) return
            setState('signing-in')
            try {
              const data = await api<{ reader: Reader }>('/api/public/auth/google', {
                method: 'POST',
                body: JSON.stringify({ credential }),
              })
              signedInRef.current(data.reader)
              setState('ready')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
              setState('error')
            }
          },
        })
        const dark = document.documentElement.dataset.theme !== 'light'
        buttonRef.current.replaceChildren()
        gsi.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: Math.min(320, Math.max(200, buttonRef.current.clientWidth)),
        })
        setState('ready')
      })
      .catch(() => {
        if (!alive) return
        setError('Google sign-in could not load. A content blocker may be stopping it; allow accounts.google.com and try again.')
        setState('error')
      })
    return () => { alive = false }
  }, [open, available])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="signin-title"
      aria-describedby="signin-desc"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-bg p-0 text-ink shadow-lift backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="signin-title" className="text-xl font-semibold tracking-[-0.01em] text-ink">
            {reason ? TITLES[reason] : 'Sign in'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-ink light:hover:bg-black/5"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p id="signin-desc" className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Use your Google account to clap for articles and join the responses. No password, no new account to manage.
        </p>

        <div className="mt-6 flex min-h-[44px] justify-center" aria-busy={state === 'loading' || state === 'signing-in'}>
          {available && GOOGLE_CLIENT_ID ? (
            <div ref={buttonRef} className="flex w-full max-w-[320px] justify-center" />
          ) : (
            <p role="status" className="text-sm text-muted">Sign-in isn&apos;t available right now. Please check back soon.</p>
          )}
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-[1.25rem] text-center text-sm">
          {state === 'signing-in' && <span className="text-muted">Signing you in…</span>}
          {state === 'error' && <span className="text-fail">{error}</span>}
        </p>

        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-subtle">
          Google shares your name, email address and profile picture with this blog. Your name and picture appear with
          your responses; your email address is never shown. See the{' '}
          <Link href="/privacy-policy#google-sign-in" className="text-primary-light" onClick={onClose}>privacy policy</Link>.
        </p>
      </div>
    </dialog>
  )
}

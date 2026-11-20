'use client'

import { useEffect, useRef, useState } from 'react'
import { compactCount } from './api'
import { usePostEngagement } from './PostEngagement'
import { useReader } from './ReaderContext'

/* A clapping hand with motion lines. The hand is Lucide's "hand" icon (ISC
   licence), tilted and scaled; the motion lines are drawn for this blog. */
export function ClapIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-18 13 14) translate(2.2 2.6) scale(0.82)">
        <path d="M18 11V6a2 2 0 0 0-4 0" />
        <path d="M14 10V4a2 2 0 0 0-4 0v2" />
        <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
      </g>
      <path d="M5.2 5.6 3.6 4M8.6 3.6 8.2 1.4M3 8.8.9 8.4" />
    </svg>
  )
}

export function ResponseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.1 0-2.2-.2-3.1-.6L4 20l1.3-3.7C4.5 15 4 13.3 4 11.5 4 7.4 7.6 4 12 4s8 3.4 8 7.5Z" />
    </svg>
  )
}

const HOLD_DELAY_MS = 380
const HOLD_EVERY_MS = 130

/** The clap button with its total, the reader's own count as a "+N" bubble,
 *  and Undo. Press for one clap, or hold to keep clapping (up to the limit). */
function ClapButton({ size }: { size: 'md' | 'lg' }) {
  const { claps, myClaps, maxClaps, clap, undo, error } = usePostEngagement()
  const [bubble, setBubble] = useState(0) // changes key to replay the bubble
  const [atLimit, setAtLimit] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdEvery = useRef<ReturnType<typeof setInterval> | null>(null)
  const held = useRef(false)
  const clapRef = useRef(clap)
  clapRef.current = clap

  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    if (holdEvery.current) clearInterval(holdEvery.current)
    holdTimer.current = null
    holdEvery.current = null
  }
  useEffect(() => stopHold, [])

  const once = () => {
    const ok = clapRef.current()
    setAtLimit(!ok)
    if (!ok) stopHold()
    setBubble((b) => b + 1)
  }

  const mine = myClaps > 0
  const big = size === 'lg'
  const label = mine
    ? `Clap for this article. You clapped ${myClaps} of ${maxClaps} times${claps !== null ? `; ${claps} claps in all` : ''}.`
    : `Clap for this article${claps !== null ? ` (${claps} claps so far)` : ''}`

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={label}
        aria-pressed={mine}
        title={atLimit ? `${maxClaps} claps is the most one reader can give` : 'Clap (hold to keep clapping)'}
        onClick={() => {
          if (held.current) { held.current = false; return }
          once()
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          held.current = false
          holdTimer.current = setTimeout(() => {
            held.current = true
            once()
            holdEvery.current = setInterval(once, HOLD_EVERY_MS)
          }, HOLD_DELAY_MS)
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        className={`group relative inline-flex select-none items-center justify-center rounded-full border transition-[color,border-color,background-color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100 ${
          big ? 'h-12 w-12' : 'h-10 w-10'
        } ${
          mine
            ? 'border-primary/50 bg-primary/10 text-primary-light'
            : 'border-line text-muted hover:border-line-strong hover:text-ink'
        }`}
        style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' }}
      >
        <ClapIcon className={big ? 'h-6 w-6' : 'h-5 w-5'} />
        {bubble > 0 && mine && (
          <span
            key={bubble}
            aria-hidden="true"
            className="clap-bubble pointer-events-none absolute -top-9 left-1/2 flex h-8 min-w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary px-2 font-mono text-xs font-semibold text-white"
          >
            +{myClaps}
          </span>
        )}
      </button>
      <span className="min-w-[2ch] font-mono text-sm tabular-nums text-muted" aria-hidden="true">
        {claps !== null && claps > 0 ? compactCount(claps) : ''}
      </span>
      {mine && (
        <button
          type="button"
          onClick={() => { setAtLimit(false); undo() }}
          className="ml-1 rounded-full px-2 py-1 text-xs text-subtle underline-offset-2 transition-colors hover:text-ink hover:underline"
          aria-label={`Undo your ${myClaps} clap${myClaps === 1 ? '' : 's'}`}
        >
          Undo
        </button>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {mine ? `You clapped ${myClaps} time${myClaps === 1 ? '' : 's'}.` : ''}
        {atLimit ? ` ${maxClaps} claps is the most one reader can give.` : ''}
      </span>
      {error && <span role="alert" className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-fail">{error}</span>}
    </div>
  )
}

/** "N responses": jumps to the responses below the article. */
function ResponsesLink({ size }: { size: 'md' | 'lg' }) {
  const { responses } = usePostEngagement()
  const label = responses === null ? 'Go to the responses' : `${responses} response${responses === 1 ? '' : 's'}: go to the responses`
  return (
    <a
      href="#responses"
      aria-label={label}
      title="Responses"
      className={`inline-flex items-center gap-1.5 rounded-full px-2 text-muted no-underline transition-colors hover:text-ink ${size === 'lg' ? 'h-12' : 'h-10'}`}
    >
      <ResponseIcon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
      <span className="min-w-[1ch] font-mono text-sm tabular-nums">{responses ? compactCount(responses) : ''}</span>
    </a>
  )
}

/** Medium-style action bar: clap and responses on the left, sharing on the right. */
export default function EngagementBar({ size = 'md', children }: { size?: 'md' | 'lg'; children?: React.ReactNode }) {
  // Clapping needs Google sign-in; until it is switched on, the clap button stays hidden.
  const { available } = useReader()
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-3">
        {available && <ClapButton size={size} />}
        <ResponsesLink size={size} />
      </div>
      {children && <div className="min-w-0">{children}</div>}
    </div>
  )
}

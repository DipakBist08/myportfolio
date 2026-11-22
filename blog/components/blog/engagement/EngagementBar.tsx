'use client'

import { useState } from 'react'
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

/** The clap button with the post's total. One clap per reader (the owner's
 *  rule, 22/11/2026): press to clap, press again to take the clap back. */
function ClapButton({ size }: { size: 'md' | 'lg' }) {
  const { claps, clapped, toggleClap, error } = usePostEngagement()
  const [pop, setPop] = useState(0) // changes key to replay the clap animation
  const big = size === 'lg'
  const total = claps !== null ? ` ${claps} clap${claps === 1 ? '' : 's'} so far.` : ''
  const label = clapped
    ? `Clap for this article: you clapped. Press again to take your clap back.${total}`
    : `Clap for this article.${total}`

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={label}
        aria-pressed={clapped}
        title={clapped ? 'You clapped. Press again to take it back.' : 'Clap'}
        onClick={() => {
          if (!clapped) setPop((n) => n + 1)
          toggleClap()
        }}
        className={`group relative inline-flex select-none items-center justify-center rounded-full border transition-[color,border-color,background-color,transform] duration-150 active:scale-95 motion-reduce:active:scale-100 ${
          big ? 'h-12 w-12' : 'h-10 w-10'
        } ${
          clapped
            ? 'border-primary/50 bg-primary/10 text-primary-light'
            : 'border-line text-muted hover:border-line-strong hover:text-ink'
        }`}
        style={{ touchAction: 'manipulation' }}
      >
        <span key={pop} className={pop > 0 && clapped ? 'clap-pop inline-flex' : 'inline-flex'}>
          <ClapIcon className={big ? 'h-6 w-6' : 'h-5 w-5'} />
        </span>
      </button>
      <span className="min-w-[2ch] font-mono text-sm tabular-nums text-muted" aria-hidden="true">
        {claps !== null && claps > 0 ? compactCount(claps) : ''}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {clapped ? 'You clapped for this article.' : ''}
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

'use client'

import { useEffect, useState } from 'react'
import ShareLinks from './ShareLinks'

interface ShareButtonsProps {
  title: string
  /** The page's canonical URL. Required, so the links are complete in the server HTML. */
  url: string
  /** A one-line summary, used in the email body and the device share sheet. */
  text?: string
  /** Visible label before the buttons. */
  label?: string
}

const PILL =
  'flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-primary hover:text-ink'

/**
 * Share a post on LinkedIn, Facebook, X, WhatsApp, Telegram, Reddit or by
 * email (ShareLinks), copy its link, or, on devices that support it (most
 * phones), open the system share sheet, which reaches every other installed
 * app: Instagram, Messenger, Viber, Slack, SMS and more.
 *
 * The "More" button is in the server HTML from the start and only becomes
 * visible once the browser reports share support, so nothing moves on load.
 */
export default function ShareButtons({ title, url, text, label = 'Share' }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      return // clipboard blocked: the share links still work
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openShareSheet = async () => {
    try {
      await navigator.share({ title, text, url })
    } catch {
      /* the reader closed the sheet */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShareLinks title={title} url={url} text={text} label={label} />
      <button type="button" onClick={copyLink} className={PILL} aria-live="polite">
        {copied ? (
          <>
            <svg className="h-3.5 w-3.5 text-pass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-pass">Copied!</span>
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Copy link
          </>
        )}
      </button>

      <button
        type="button"
        onClick={openShareSheet}
        className={`${PILL} ${canShare ? '' : 'invisible'}`}
        aria-hidden={!canShare}
        tabIndex={canShare ? 0 : -1}
        aria-label="More ways to share"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" strokeLinecap="round" />
        </svg>
        More
      </button>
    </div>
  )
}

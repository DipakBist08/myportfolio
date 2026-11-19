'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  GA_MEASUREMENT_ID,
  SETTINGS_EVENT,
  readConsent,
  signalsOptOut,
  startAnalytics,
  stopAnalytics,
  writeConsent,
  type Consent,
} from '@/lib/analytics'

const BUTTON =
  'inline-flex min-h-11 flex-1 basis-32 items-center justify-center rounded-lg border border-line-strong px-4 text-[0.9375rem] font-medium text-ink transition-colors hover:border-primary max-[479px]:basis-0 max-[479px]:px-2'

/** Asks before Google Analytics loads (rules in lib/analytics.ts). Renders
 *  nothing without a measurement ID, or for a browser that sends Global
 *  Privacy Control or Do Not Track. */
export default function ConsentBanner() {
  const [open, setOpen] = useState(false)
  const focusOnOpen = useRef(false)
  const decline = useRef<HTMLButtonElement>(null)
  const banner = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || signalsOptOut()) return
    const consent = readConsent()
    if (consent === 'granted') startAnalytics(GA_MEASUREMENT_ID)
    else if (consent !== 'denied') setOpen(true)
    const reopen = () => {
      focusOnOpen.current = true
      setOpen(true)
    }
    window.addEventListener(SETTINGS_EVENT, reopen)
    return () => window.removeEventListener(SETTINGS_EVENT, reopen)
  }, [])

  useEffect(() => {
    if (open && focusOnOpen.current) {
      focusOnOpen.current = false
      decline.current?.focus()
    }
  }, [open])

  if (!GA_MEASUREMENT_ID || !open) return null

  const choose = (value: Consent) => {
    writeConsent(value)
    if (value === 'granted') startAnalytics(GA_MEASUREMENT_ID)
    else stopAnalytics(GA_MEASUREMENT_ID)
    const hadFocus = banner.current?.contains(document.activeElement)
    setOpen(false)
    if (hadFocus) document.getElementById('main')?.focus({ preventScroll: true })
  }

  return (
    <section
      ref={banner}
      aria-labelledby="consent-title"
      className="fixed inset-x-4 bottom-4 z-[60] flex max-h-[calc(100dvh-var(--header-height)-2rem)] max-w-[34rem] flex-col gap-3 overflow-y-auto rounded-xl border border-line-strong bg-[var(--color-bg-raised)] px-5 py-4 text-sm text-muted shadow-lg max-[479px]:inset-x-2 max-[479px]:bottom-2 max-[479px]:p-3"
    >
      <p className="m-0">
        <strong id="consent-title" className="font-semibold text-ink">Analytics cookies.</strong> May I use Google
        Analytics to see which pages are read? It sets cookies and sends usage data to Google. Advertising features are
        off. <Link href="/privacy-policy#analytics" className="text-[var(--color-accent-text)] underline">Privacy policy</Link>
      </p>
      <div className="flex flex-wrap gap-2 max-[479px]:flex-nowrap">
        <button ref={decline} type="button" className={BUTTON} onClick={() => choose('denied')}>
          Decline
        </button>
        <button type="button" className={BUTTON} onClick={() => choose('granted')}>
          Allow
        </button>
      </div>
    </section>
  )
}

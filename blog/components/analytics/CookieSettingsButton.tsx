'use client'

import { useEffect, useState } from 'react'
import { GA_MEASUREMENT_ID, SETTINGS_EVENT, signalsOptOut } from '@/lib/analytics'

/** "Cookie settings" in the footer: reopens the analytics question. Shown only
 *  when analytics is configured, and not to a browser that sends Global
 *  Privacy Control or Do Not Track (it is never tracked, so there is no
 *  choice to change). */
export default function CookieSettingsButton({ className }: { className?: string }) {
  const [optedOut, setOptedOut] = useState(false)
  useEffect(() => setOptedOut(signalsOptOut()), [])
  if (!GA_MEASUREMENT_ID || optedOut) return null
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(SETTINGS_EVENT))}>
      Cookie settings
    </button>
  )
}

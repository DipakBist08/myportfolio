'use client'

import { useEffect, useRef } from 'react'
import { ADS_ENABLED, ADSENSE_CLIENT, AD_UNIT_HEIGHT, AD_UNIT_IDS, type AdPosition } from '@/lib/ads'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const LABEL_HEIGHT = 28

/**
 * One ad position. Renders nothing at all unless NEXT_PUBLIC_ADS_ENABLED=true.
 *
 * The wrapper has a fixed min-height and the unit a fixed height, so the space
 * is reserved before any ad loads (no layout shift). Each mounted unit asks
 * AdSense for an ad exactly once; app/template.tsx remounts the page on every
 * client-side navigation, so each page's units load once per visit.
 */
export default function AdSlot({ position }: { position: AdPosition }) {
  const requested = useRef(false)
  const unitId = AD_UNIT_IDS[position]
  const live = ADS_ENABLED && Boolean(ADSENSE_CLIENT) && Boolean(unitId)

  useEffect(() => {
    if (!live || requested.current) return
    requested.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* An ad that fails to load must never break the article. */
    }
  }, [live])

  if (!ADS_ENABLED) return null

  const height = AD_UNIT_HEIGHT[position]

  return (
    <aside
      className="ad-slot not-prose"
      data-ad-position={position}
      aria-label="Advertisement"
      style={{ minHeight: height + LABEL_HEIGHT }}
    >
      <p className="ad-slot__label">Advertisement</p>
      {live ? (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={unitId}
          data-full-width-responsive="false"
        />
      ) : (
        <div className="ad-slot__preview" style={{ height }}>
          Ad preview: {position}
        </div>
      )}
    </aside>
  )
}

import Script from 'next/script'
import { ADS_ENABLED, ADSENSE_CLIENT } from '@/lib/ads'

/**
 * Loads the AdSense library. Rendered only by the post page, and only when the
 * flag is on and a real client ID has been supplied through the environment.
 * lazyOnload keeps it out of the way of the page's own content (LCP).
 */
export default function AdSenseScript() {
  if (!ADS_ENABLED || !ADSENSE_CLIENT) return null

  return (
    <Script
      id="adsense-library"
      strategy="lazyOnload"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`}
    />
  )
}

/**
 * Google Analytics 4, consent first. The same rules as the portfolio's
 * js/analytics.js, and the same consent cookie, so one answer covers
 * dipakbist.com.np and blog.dipakbist.com.np.
 *
 * - Off unless a measurement ID (G-...) is set: NEXT_PUBLIC_GA_MEASUREMENT_ID
 *   in the environment, or MEASUREMENT_ID below. Empty means no banner, no
 *   "Cookie settings" link and nothing from Google.
 * - Nothing from Google loads until the visitor chooses "Allow". "Decline" is
 *   one click too, and both buttons look the same.
 * - The choice is kept for 180 days in the first-party cookie
 *   dipak_analytics_consent, set for dipakbist.com.np.
 * - "Cookie settings" in the footer reopens the choice. Declining after
 *   allowing stops Google Analytics on the page and deletes its _ga cookies.
 * - Global Privacy Control or Do Not Track: never asked, never tracked.
 * - Google signals and ad personalisation are off.
 * - A local preview shows the banner but never loads Google
 *   (window.__analyticsAllowLocal lets a test load a stubbed script).
 * - Page views after client-side navigation come from GA4's enhanced
 *   measurement ("page changes based on browser history events", on by
 *   default for a web stream), so no page_view is sent by hand.
 */
const MEASUREMENT_ID = ''

/* NEXT_PUBLIC_ variables are inlined at build time only when written out in full. */
const RAW_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || MEASUREMENT_ID).trim()
export const GA_MEASUREMENT_ID = /^G-[A-Z0-9]{4,}$/.test(RAW_ID) ? RAW_ID : ''

export const CONSENT_COOKIE = 'dipak_analytics_consent'
/** Fired on window by "Cookie settings" to reopen the banner. */
export const SETTINGS_EVENT = 'analytics:settings'

export type Consent = 'granted' | 'denied'

const MAX_AGE = 60 * 60 * 24 * 180
const SHARED_DOMAIN = 'dipakbist.com.np'
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', ''])

type GtagWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __analyticsAllowLocal?: boolean
  [key: `ga-disable-${string}`]: boolean | undefined
}

let loaded = false

const onSharedDomain = () =>
  window.location.hostname === SHARED_DOMAIN || window.location.hostname.endsWith(`.${SHARED_DOMAIN}`)

export function readConsent(): Consent | '' {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(granted|denied)`))
  return match ? (match[1] as Consent) : ''
}

export function writeConsent(value: Consent): void {
  const domain = onSharedDomain() ? `; domain=${SHARED_DOMAIN}` : ''
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${MAX_AGE}; path=/; SameSite=Lax${domain}${secure}`
}

/** True when the browser asks sites not to track it. */
export function signalsOptOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

/* Google Analytics keeps _ga and _ga_<stream> on the widest domain it can. */
function deleteGaCookies(): void {
  const domains = ['', `; domain=${window.location.hostname}`]
  if (onSharedDomain()) domains.push(`; domain=${SHARED_DOMAIN}`)
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name !== '_ga' && !name.startsWith('_ga_')) continue
    for (const domain of domains) document.cookie = `${name}=; max-age=0; path=/${domain}`
  }
}

export function startAnalytics(id: string): void {
  const w = window as unknown as GtagWindow
  w[`ga-disable-${id}`] = false
  if (loaded) {
    w.gtag?.('consent', 'update', { analytics_storage: 'granted' })
    return
  }
  const local = LOCAL.has(window.location.hostname) || window.location.protocol === 'file:'
  if (local && w.__analyticsAllowLocal !== true) return
  loaded = true
  w.dataLayer = w.dataLayer || []
  w.gtag = function gtag() {
    // gtag.js reads the arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments)
  }
  w.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  w.gtag('js', new Date())
  w.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.append(script)
}

export function stopAnalytics(id: string): void {
  const w = window as unknown as GtagWindow
  w[`ga-disable-${id}`] = true
  if (loaded) w.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  deleteGaCookies()
}

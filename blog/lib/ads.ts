/**
 * Ads configuration. Everything is off unless NEXT_PUBLIC_ADS_ENABLED=true.
 *
 * - The AdSense client ID and the ad unit IDs come only from env variables.
 *   Nothing is hardcoded and no placeholder ID exists anywhere in the repo.
 * - With the flag on but no client ID, slots render as labeled placeholders
 *   that reserve the same space. That "preview" mode is for layout-shift
 *   checks before a real AdSense account exists; it loads no Google script.
 *
 * Positions, rules and the environment variables are in docs/ADS.md.
 */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true'
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''

export type AdPosition = 'after-intro' | 'mid-article' | 'end-of-article' | 'sidebar'

/* NEXT_PUBLIC_ variables are inlined at build time only when written out in full. */
export const AD_UNIT_IDS: Record<AdPosition, string> = {
  'after-intro': process.env.NEXT_PUBLIC_ADSENSE_SLOT_AFTER_INTRO || '',
  'mid-article': process.env.NEXT_PUBLIC_ADSENSE_SLOT_MID_ARTICLE || '',
  'end-of-article': process.env.NEXT_PUBLIC_ADSENSE_SLOT_END_OF_ARTICLE || '',
  sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || '',
}

/** Fixed heights (px) of the ad unit itself, so the page never moves when an ad loads. */
export const AD_UNIT_HEIGHT: Record<AdPosition, number> = {
  'after-intro': 250,
  'mid-article': 250,
  'end-of-article': 250,
  sidebar: 600,
}

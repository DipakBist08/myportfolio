/* The first page a reader opens arrives as server HTML and must be visible at
   once: it is what Lighthouse measures as LCP, and some readers and crawlers
   never run JavaScript. So entrance animations are skipped until the app has
   hydrated, and play only on client-side navigations after that.
   On the server this stays false forever, because effects never run there. */
let hydrated = false

export const isFirstLoad = () => !hydrated

export function markHydrated() {
  hydrated = true
}

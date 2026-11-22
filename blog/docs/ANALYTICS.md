# Google Analytics 4 (consent first)

The blog and the portfolio share one GA4 setup. Both are **off** until a measurement ID is set; until then there is no banner, no "Cookie settings" link and nothing from Google.

## Turning it on

1. In Google Analytics, create a GA4 property with one **web data stream** for `https://dipakbist.com.np`. One stream covers both sites, because the blog is a subdomain.
2. Keep the stream's enhanced measurement setting **"Page changes based on browser history events"** on (the default). The blog navigates client-side, and that setting is what records those page views.
3. Copy the stream's measurement ID (`G-...`) and set it in both places:
   - blog: `MEASUREMENT_ID` in `lib/analytics.ts`, or the `NEXT_PUBLIC_GA_MEASUREMENT_ID` environment variable in the Vercel project `dipak-blog`;
   - portfolio: `<meta name="ga-measurement-id" content="G-...">` in `index.html`.
4. Set the data retention period you want (Admin, Data retention), state it in the privacy policy (the `CHECK` in `app/privacy-policy/page.tsx`), and update `SITE_PAGES.privacyPolicy.updated`.

## What it does

- Nothing from Google loads until the visitor chooses **Allow**. **Decline** is one click, and both buttons look the same.
- The choice is kept for 180 days in the first-party cookie `dipak_analytics_consent`, set for `dipakbist.com.np`, so one answer covers both sites.
- **Cookie settings** in the footer reopens the choice. Declining after allowing stops GA on the page and deletes the `_ga` cookies.
- A browser that sends Global Privacy Control or Do Not Track is never asked and never tracked.
- Google signals and ad personalization are off.
- Local previews show the banner but never load Google.
- With an ID, the privacy policy gains its "Google Analytics" section (`#analytics`, where the banner links). Without one, it still says no third-party analytics is used.

Code: `lib/analytics.ts`, `components/analytics/ConsentBanner.tsx` and `components/analytics/CookieSettingsButton.tsx`. The portfolio's twin is `js/analytics.js`.

Checks: build with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123456`, serve it, and run `check_analytics.py <url>` (kept outside the repo, in the SEO tools). Every Google request is stubbed. Without an ID, run it with `--expect-off`.

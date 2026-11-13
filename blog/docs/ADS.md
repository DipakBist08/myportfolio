# Ads (Google AdSense): switched off

Ads are built in but **off**. With the default settings the site renders no ad markup, loads no ad script and sets no ad cookies. Do not switch them on until the AdSense account is approved and the privacy policy has been reviewed.

## Environment variables

Set these in the Vercel project for the blog (Settings, Environment Variables). `NEXT_PUBLIC_` values are read at build time, so redeploy after changing them. Never commit real IDs to the repository.

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_ADS_ENABLED` | unset (off) | `true` renders the ad slots. Anything else renders nothing. |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | unset | The AdSense publisher ID from your AdSense account (it starts with `ca-pub-`). Without it no Google script loads. |
| `NEXT_PUBLIC_ADSENSE_SLOT_AFTER_INTRO` | unset | Ad unit ID for the slot after the intro. |
| `NEXT_PUBLIC_ADSENSE_SLOT_MID_ARTICLE` | unset | Ad unit ID for the mid-article slot. |
| `NEXT_PUBLIC_ADSENSE_SLOT_END_OF_ARTICLE` | unset | Ad unit ID for the end-of-article slot. |
| `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR` | unset | Optional desktop sidebar slot (not placed on the page yet). |

**Preview mode:** `NEXT_PUBLIC_ADS_ENABLED=true` with no client ID shows dashed placeholders labeled "Ad preview" in every position, at the real size, and loads nothing from Google. Use it in a preview deployment to check layout and Lighthouse before the account exists.

## Where the slots go

| Slot | Position | Inserted by |
|---|---|---|
| `after-intro` | After the intro and the Key takeaways box, before the first H2 | `lib/blog/remarkAdSlots.ts` |
| `mid-article` | Before the H2 nearest the middle; only in posts with 4 or more H2 sections | `lib/blog/remarkAdSlots.ts` |
| `end-of-article` | After the article and its FAQ, before the author box | `app/blog/[slug]/page.tsx` |
| `sidebar` | Optional, desktop only; not placed | — |

Rules the code enforces:

- **Never above the H1 or the intro.** The first slot always comes after the Key takeaways box.
- **Never next to code or a copy button.** If the block above a slot, or the first block under the heading after it, is a code block or a component with a copy button (`CodeBlock`, `CommandBlock`, `PromptBlock`, `APIRequest`, `BugReport`, `TestCase`), the slot moves to the next H2. If no H2 is safe, the slot is left out.
- **Space is reserved.** Each slot has a fixed `min-height` (28 px label plus a 250 px unit), so the page does not move when an ad loads.
- **Labeled.** Each slot says "Advertisement".
- **Post pages only.** The AdSense script (`components/ads/AdSenseScript.tsx`) is rendered only by the post page, only when the flag is on and a client ID exists, with `next/script` and `strategy="lazyOnload"`.
- **One request per unit per page.** Each slot pushes to `adsbygoogle` once when it mounts. `app/template.tsx` remounts the page on every client-side navigation, so each page's units load once per visit.
- **Never on the portfolio** (dipakbist.com.np). The ad code exists only in this blog app.

## ads.txt

The blog is a subdomain, so `ads.txt` must be served from the root domain: `https://dipakbist.com.np/ads.txt`, in the portfolio, not here. Create it only with the exact line AdSense gives you. Check it with `curl -I https://dipakbist.com.np/ads.txt`: 200 and `text/plain`.

## Turning ads on

1. AdSense approves the site.
2. The privacy policy (`app/privacy-policy/page.tsx`) has been reviewed and its draft notice removed.
3. The EEA, UK and Switzerland consent message is set up in AdSense (Privacy & messaging).
4. Set the variables above in a **preview** deployment, run mobile Lighthouse on two or three posts, and check CLS stays under 0.1 and LCP under 2.5 s.
5. Set them in production and redeploy.

# Design and build notes

Static site, no build step. Open `index.html` from any static server (`npm run serve`), deploy as-is (Vercel, `vercel.json`).

## Concept

A QA engineer's portfolio. The one piece of test code a visitor sees is the hero's short login test (below). Sections show content only: no assertion lines, node ids or verdicts, and no floating results pill or panel. The owner had these removed on 12/11/2026 as clutter, and `test_sections_show_content_not_test_scaffolding` keeps them out.

The page itself is tested from outside, in `tests/`, with pytest + Playwright (Python) on a desktop and a phone viewport. `tests/test_page.py` checks the page as a whole: title, fonts loaded, hero in the first viewport, contrast of the h1, console errors, layout shift via `PerformanceObserver`, alt text, in-page anchors, reduced motion, theme storage. `tests/test_sections.py` checks one thing per section: portrait alt, 10 workflow steps, roles in date order, safe evidence links, secure project links, posts by date, the mailto link. Measuring helpers (`contrast_ratio`, `dead_anchors`, `role_dates`, …) are in `tests/helpers.py`.

## Workflow section: a feedback loop

The ten workflow steps (the owner's wording, unchanged) are grouped into four stages, marked on the first step of each: Plan (01–03), Test (04–07), Release (08–09) and Learn (10).

- **Wide (the section at least 1080px wide, a container query on `.workflow > .container`).** The steps sit clockwise around a 270px ring starting at 12 o'clock, every 36°, with a dashed arrow carrying 10 back into 01. The counter and the intro sit in the centre.
- **Positions.** Each step's mark (`--mx`, `--my`) and text anchor (`--tx`, `--ty`) are fixed offsets from the ring's centre, set inline in the markup. Side text sits as close to the ring as it can without touching it anywhere along its height. If you change the radius or a text block's size, recompute them.
- **Narrow.** The same markup is a vertical timeline in order, ending in "Then back to 01".
- **Animation (wide).** When the loop is at least 45% on screen, a point (`.workflow__head`) travels it once, clockwise from 01, on one `requestAnimationFrame` clock in `runLoop` (`js/motion.js`). Each step (`--step-ms`, 330ms) is a move with a cubic ease-in-out followed by a short stop at the mark. The line fills behind the point, and the step ticks with a spring, pulses once (`.step__mark::before`) and comes into focus, because unreached steps sit at 40% opacity with a 1.5px blur (`.is-armed`). After 10 the point rides the dashed return arc back towards 01; a mask (`#workflow-return`, `.workflow__reveal`) uncovers the arc behind it. Then 01 pulses again (`.is-again`). A run takes about 3.6s.
- **Animation (narrow).** Each step ticks when it, or a later one, is 60% on screen, and the accent line (`.step::after`) fills down to it.
- **Replay.** When the loop has fully left the screen, or the tab is hidden, the section resets out of sight: nothing ticked, counter 0, line undrawn, and the running clock cancelled. It plays again the next time it is well in view. With reduced motion it stays in its finished state.
- **Hover (wide, pointer devices).** Pointing at a step's text scales its mark, to show where it sits on the ring.
- `test_workflow_reads_in_order_as_a_loop_or_a_timeline` checks the order, angles, overlaps and ticking at several widths. `test_workflow_plays_again_after_leaving_or_switching_tabs` scrolls away and back, then hides the tab part-way through a run (headless pages are always "visible", so it overrides `document.hidden` and dispatches `visibilitychange`). It checks the reset, that nothing ticks while hidden, and that the replay counts 1 to 10 in order.

## Hero code panel

The hero shows one short pytest + Playwright test of a complete login flow (`test_login.py`, pointed at `app.example.com`): an example of how the tests are written, not a check of this page. Once the hero's entrance has landed the panel and at least half of it is on screen (on phones it starts below the fold and waits there; `test_hero_flow_waits_until_it_can_be_seen`), `js/flow.js` steps through its five actions in order (open, fill email, fill password, sign in, assert the dashboard). After a short beat it prints the result line exactly as pytest -v prints it for this file: `test_login.py::test_login[chromium] PASSED [100%]`. pytest-playwright adds the browser to the node id of every test that uses `page`. With reduced motion it shows the finished state at once. The panel's Re-run button (`[data-flow-rerun]`) plays the flow again from its first step; a run the visitor asks for also plays with reduced motion (colour changes only), and its result is announced through a polite live region (`#flow-live`). A run counter in `js/flow.js` stops an abandoned run from stepping alongside the new one (`test_hero_flow_restarts_cleanly_when_rerun_is_pressed_mid_run`). Only classes change, so the run causes no layout shift. Credentials come from `os.environ[...]`, so a missing secret fails loudly. `test_hero_code_is_a_valid_clean_test` compiles the displayed code and holds it to PEP 8's line length and blank-line rules. Layout is decided by the panel's own width, measured in the code's characters (a container query on `.flow__code`). When the panel holds the longest statement (67 characters plus the gutter), every statement stays on one line and the `<wbr>` break points are switched off. That happens from 1280px, where the hero columns are equal and the code is 11.5px. Otherwise the code is 12px below 1280px, and a long statement soft-wraps at a call boundary (`<wbr>` after an opening bracket or before a method call) with a two-column hanging indent. Its indentation and first call (`.flow__lead`) and its string literals never split, so no line starts empty and `"Sign in"` stays whole. A larger browser font or zoom falls back to wrapping rather than overflowing, and down to a 320px phone nothing runs past the panel. `test_hero_code_keeps_its_shape` checks all of this.

## Caching: one version of everything

A page drawn from new HTML with an older stylesheet or script looks broken (an unstyled code panel, a run that never finishes). Three things prevent that mix:

- Every local stylesheet and script URL carries the same `?v=` tag: the `<link>`s and entry `<script>` in `index.html` and `404.html`, and each `import` in `js/main.js`. Change the tag in all of them together when CSS or JS changes in a way an old copy would break; `test_stylesheets_and_scripts_share_one_version` fails if they drift or if a new import lacks it.
- `vercel.json` serves `/css` and `/js` with `max-age=0, must-revalidate`, so browsers check for a newer copy on every visit (a quick 304 when nothing changed).
- `npm run serve` runs `tools/serve.py`, which sends `Cache-Control: no-cache`. Plain `python3 -m http.server` sends no caching header, and browsers then guess a lifetime from each file's age and keep stale copies for days.

## Files

| Path | Role |
|---|---|
| `css/tokens.css` | Design tokens: primitives → semantic (dark default, `[data-theme="light"]`) → component. Self-hosted fonts. |
| `css/base.css` | Reset, typography, browser surfaces, layout primitives, the reveal gate, reduced-motion fallback. |
| `css/site.css` | Header, hero + code panel, every section, footer, responsive rules. |
| `js/main.js` | Entry (ES module). Each init is isolated; a motion failure reveals the page. |
| `js/flow.js` | The hero code panel's step-by-step run and its Re-run button. |
| `tools/serve.py` | Local preview server behind `npm run serve` (port 4173, `Cache-Control: no-cache`). Not deployed. |
| `tools/og/` | `render.py` renders `og-image.html` to `assets/og-image.png` (the link-preview image), failing on unloaded fonts, touching or overlapping text, text near the edge, or a file over 300 KB. The card quotes the hero's `test_login.py` verbatim; `test_link_preview_card_quotes_the_hero_verbatim` fails if they drift, so re-render after changing the hero. Not deployed (`.vercelignore`). |
| `js/motion.js` | Choreography on the vanilla framer-motion DOM API (`assets/vendor/framer-motion-dom.js`, `window.Motion`). |
| `js/theme.js`, `js/nav.js`, `js/subscribe.js`, `js/contact.js` | Theme, navigation/menu/active section, newsletter form, contact form. |
| `js/visit.js` | One visit beacon per page load for the CMS dashboard (see "Visits" below). |
| `tests/portfolio.spec.ts` | Playwright suite from the visitor's perspective (`npm test`). |

## Visits and comment reactions (CMS)

The portfolio (`js/visit.js`) and the blog (`components/blog/PageViewTracker.tsx`, `PostViews.tsx`) report page views to the CMS API's `POST /api/public/track`. Blog post pages show "Seen by N readers" in their comments header, and comments and replies have like and dislike buttons (`POST /api/public/comments/{id}/reaction`). The admin dashboard's "Website traffic" section (`cms/frontend/src/components/dashboard/TrafficPanel.tsx`, `GET /api/v1/analytics/traffic`) shows visitors and page views (today, the period, all time, a daily chart in the admin's time zone, a split by site, top pages) and, per blog post, views, readers, comments, likes and dislikes. The admin Comments page shows each comment's reactions.

- **No cookies, no stored IP.** A visitor is a keyed hash (HMAC-SHA256 with the CMS `SECRET_KEY`) of IP address and user agent (`cms/backend/app/core/visitor.py`). A reload of the same page within 30 minutes counts once; crawlers, link-preview fetchers and scripted clients are not counted. Only the referrer's host name is kept.
- **Nothing is sent** from a local preview against the live API, or when the browser sends Do Not Track or Global Privacy Control.
- The portfolio sends its beacon as `text/plain` with `navigator.sendBeacon`, which needs no CORS permission; the blog reads its numbers back, so its origin must be in the API's `ALLOWED_ORIGINS` (it already is).
- The data lives in two new tables, `page_views` and `comment_reactions`, which `create_all` adds at startup; no existing table changes. Backend tests: `cd cms/backend && pip install -r requirements.txt && pytest`.

## Type and colour

- Display and body: Bricolage Grotesque (variable: weight, width, optical size). Code, assertions, dates, numbers: JetBrains Mono. Both self-hosted in `assets/fonts/` (latin subsets, `font-display: swap`).
- One accent hue (indigo) on zinc neutrals. Accent is for state only: the active nav item, the focus ring, links, the primary button, a reached workflow step, the step that is running in the hero. Green is for the hero's completed steps and PASSED; red for form errors.
- Both themes are first-class. Every text/background pair was measured at AA or better; the Playwright suite re-measures on every run.

## Motion thesis

- Focal moment: hero lines rise in a sequence; the code panel lands last; then its login flow steps through to PASSED.
- Continuity: scroll-linked progress bar; sections fade/rise once on entry; in the workflow loop a ticket travels the ring, stopping at each step (it ticks, pulses and comes into focus), then rides the return arc back into 01. It replays each time the section comes back into view (see "Workflow section").
- Feedback: springs on check marks and press; a 4px lift on cards (pointer devices only).
- Budget: no ambient loops, no particles, no cursor followers, no typewriter. Nothing moves off-screen.
- Reduced motion: `html` never gets the `anim` class; everything renders in its final state (every workflow step ticked, the hero run finished).
- Robustness: `[data-reveal]` elements are hidden only while `html.anim.motion` is present. The inline head script removes `motion` after 3s if the module never arrives; the module removes it on any error.

## Content rules

Every number, employer, date, title, link and description is the owner's own copy, carried over verbatim. Projects without a public link say so in plain words ("Repository not public yet", "Internal work, no public link") rather than show a fake link. Open items for Dipak are left as HTML comments (higher-resolution portrait, REST framework repository URL, QADocs artefacts, whether to list other AI tools). Social links are LinkedIn, GitHub and Instagram only, as confirmed by the owner on 12/11/2026.

## Running the tests (pytest + Playwright, Python)

```
npm run test:setup                 # once: creates .venv, installs pytest-playwright and Chromium
source .venv/bin/activate
pytest                             # serves the site on a free port; every browser test runs on a desktop and a phone viewport
pytest --headed -k journeys        # watch a subset
BASE_URL=https://dipakbist.com.np pytest   # run against the deployed site
```

`tests/test_page.py` checks the page as a whole and `tests/test_sections.py` each section; `tests/test_journeys.py` covers the visitor's side (first viewport, the hero code panel, navigation, actions, forms, themes, keyboard, contrast, 404). A TypeScript twin (`tests/portfolio.spec.ts`, `npm run test:ts`) is kept for teams on `@playwright/test`.

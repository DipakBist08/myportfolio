# Post template and SEO standard

Every post in `content/blog/` follows this standard. `scripts/seo-lint.mjs` checks it before every build (`npm run build`) and stops the build when a **published** post breaks a rule. Drafts are checked too, but their problems only show as warnings.

```bash
npm run seo:lint   # check all posts now
npm run test:seo   # run the lint's own tests
```

## 1. Start a new post

1. Pick the slug. It is the file name and the URL, and it never changes after publishing: `content/blog/<slug>.mdx` is served at `/blog/<slug>`.
2. Copy the skeleton in section 8 into that file. Keep `draft: true` until the post is approved.
3. Drafts are visible in `npm run dev`, and in a production build only with `SHOW_DRAFTS=true`. They are never in the sitemap or RSS feed, and they are `noindex`.

## 2. Front matter

| Field | Required | Rule |
|---|---|---|
| `title` | Yes | The H1 and the `<title>`. With the ` \| Dipak Bist` suffix the site adds, at most 65 characters, so the title itself is at most 52. Primary query near the start. Do not type the suffix. |
| `description` | Yes | 140 to 160 characters. Contains the primary query and a reason to click. |
| `slug` | Yes | Same as the file name. |
| `primaryQuery` | Yes | One query per post. Two published posts may not share one (the lint fails on duplicates). |
| `secondaryQueries` | Yes | A list (can be empty). |
| `cluster` | Yes | A slug from `lib/blog/clusters.json` (see section 6). |
| `isPillar` | Yes | `true` only for the cluster's pillar post. |
| `datePublished` | Yes | `YYYY-MM-DD`. Never changes. |
| `dateModified` | Yes | `YYYY-MM-DD`. Update it whenever the content changes. |
| `testedWith` | If the post has runnable code | Tool versions the examples were run with, for example `Playwright for Python 1.65.1, pytest 9.2.0, Python 3.12.3`. Shown under the title. |
| `draft` | Yes | `true` until approved. |
| `faq` | Yes | 3 to 5 items, each `q` (a question people actually search) and `a` (a direct answer of 40 to 60 words, plain text). |
| `category` | Yes | The cluster's hub category (section 6), so the post appears on that hub page. |
| `tags` | Yes | A few topic tags. |
| `author` | Yes | `Dipak Bist`. |
| `excerpt` | Yes | One or two sentences, shown under the H1 and on cards. |
| `difficulty`, `tools`, `featured` | No | Shown on the page and cards. |

Older posts used `date` and `updatedAt`. The site still reads those, but the lint requires `datePublished` and `dateModified`.

## 3. Body structure

1. **No H1 in the body.** The page renders the title as the only H1. Sections start at `##`.
2. **Intro:** 2 to 3 sentences that answer the main question directly. This is the text search snippets and AI tools quote.
3. **`<KeyTakeaways>`** box right after the intro.
4. **H2 sections**, phrased as the questions people search where that reads naturally. The first 40 to 60 words of each section answer its question.
5. **Code** in fenced blocks with a language and a title: ` ```python title="tests/test_login.py" `. Every block gets a copy button automatically.
6. **Images:** original screenshots or diagrams, not stock photos (see section 5).
7. **"Common mistakes"** section where it fits.
8. **FAQ:** comes from the `faq` front matter and is rendered after the body. Do not write it in the body.
9. Related posts, the author box and the share links are added by the page.

Available components: `KeyTakeaways`, `Callout` (`type`: info, tip, warning, success, error), `QAChecklist`, `BugReport`, `TestCase`, `APIRequest`, `PromptBlock`, `Steps`, `Figure`, `Badge`.

## 4. Links

- At least **3 internal links** to different pages: the cluster pillar plus 2 related posts. Before the pillar is published, a related post or the cluster's category hub counts instead (the lint only warns about the missing pillar).
- Once the pillar is published, every spoke must link to it, and the pillar must link to every published spoke. The lint enforces both.
- Link text says what is behind the link: "[how to write Playwright API tests in Python](/blog/playwright-api-testing-guide)", never "click here".
- Internal links use paths (`/blog/<slug>`). Links to drafts, missing posts or missing headings (`#anchor`) fail the build.
- Link the official documentation for every tool and claim: Playwright, pytest, Python, Microsoft, Atlassian, MDN.

## 5. Images

- Put them in `public/images/<slug>/` with descriptive file names (`trace-viewer-failed-step.webp`, not `image1.png`).
- Use WebP (the lint warns on other local formats).
- Use `<Figure src="/images/<slug>/name.webp" alt="..." width={1200} height={675} caption="..." />` so width and height are set. Images in post bodies load lazily.
- Every image needs alt text that describes it; the lint fails on a missing or empty `alt`.
- Share images are generated automatically: every post gets a 1200x630 card at `/og/<slug>` with its title. Do not set `coverImage` to a stock photo.

## 6. Clusters and hubs

The source of truth is `lib/blog/clusters.json`. A cluster's category page is its hub: it shows the cluster intro and lists the pillar first.

| Cluster slug | Name | Hub category | Pillar slug |
|---|---|---|---|
| `playwright-python` | Playwright with Python | Playwright | `playwright-python-guide` |
| `api-testing` | API testing | API Testing | `api-testing-guide` |
| `qa-fundamentals` | QA fundamentals | QA Fundamentals | `qa-fundamentals-guide` |
| `multi-tenant-saas` | Testing multi-tenant SaaS | SaaS Testing | `multi-tenant-saas-testing-guide` |
| `bdd-behave` | BDD with Behave | BDD | `behave-python-bdd-guide` |
| `jmeter-performance` | Performance testing with JMeter | Performance Testing | `jmeter-performance-testing-guide` |
| `ai-lab` | AI Lab | AI Lab | `ai-in-qa-guide` |
| `qa-careers` | QA careers | QA Career | `how-to-become-qa-engineer-in-nepal` |

**The menu** is "Articles" followed by the sections in `lib/blog/sections.json` (exported as `NAV_SECTIONS` from `lib/blog/site.ts`), in that order: QA Fundamentals, Automation, AI Lab. The SEO lint reads the same file, so links to any section hub are valid.

- A section named after one category, such as QA Fundamentals or AI Lab, links to that category's hub.
- **Automation** groups several categories: Automation Testing, Playwright, API Testing, BDD, Performance Testing and CI/CD. Its page at `/blog/category/automation` lists every post in them. Each of those categories keeps its own hub, and on those hubs the menu highlights Automation. The Automation page is indexed (and in the sitemap) only once its posts come from at least two of those categories; until then it would repeat one category hub, so it stays `noindex` (`hubIsIndexable` in `lib/blog/utils.ts`).
- The footer also links every other category hub that has a published post.
- A section is in the menu before its first post. Its page then shows its intro and "No … articles yet", is `noindex` and stays out of the sitemap. Both change automatically with its first published post.

## 7. Code examples and experience notes

- Every runnable example lives in `examples/<slug>/` with `requirements.txt` (pinned versions), its tests and a `README.md` that records how it was run and the passing output. Run it before publishing and copy the versions into `testedWith`.
- Never invent first-hand experience. Where a personal example would help, leave a note for the author:
  - In a **draft**: `[ADD YOUR EXPERIENCE: what to add]` as visible text. The lint fails the build if visible note text is still there when `draft` becomes `false`.
  - In a **live post**: `{/* [ADD YOUR EXPERIENCE: what to add] */}`. The note is an MDX comment that readers never see. The lint lists it as a warning until it is written.
- No details about any employer, its product or its clients. Examples stay generic.

## 8. Skeleton

```mdx
---
title: "Primary Query First: The Benefit (max 52 characters)"
description: "140 to 160 characters that contain the primary query and give a concrete reason to click, such as a tested example, template or checklist."
slug: "the-file-name"
primaryQuery: "the one query this post targets"
secondaryQueries:
  - "a related query"
cluster: "playwright-python"
isPillar: false
datePublished: "YYYY-MM-DD"
dateModified: "YYYY-MM-DD"
testedWith: "Playwright for Python X.Y.Z, pytest X.Y.Z, Python X.Y.Z"
draft: true
category: "Playwright"
tags: ["Playwright", "Python"]
author: "Dipak Bist"
excerpt: "One or two sentences shown under the title and on cards."
difficulty: "intermediate"
faq:
  - q: "A question people actually search?"
    a: "A direct answer in 40 to 60 words, in plain text."
  - q: "A second question?"
    a: "..."
  - q: "A third question?"
    a: "..."
---

Two or three sentences that answer the main question directly.

[ADD YOUR EXPERIENCE: what first-hand example belongs here]

<KeyTakeaways>
- The most important point.
- The second.
- The third.
</KeyTakeaways>

## The first question this post answers?

Answer it in the first 40 to 60 words, then show how.

```python title="tests/test_example.py"
# tested code from examples/the-file-name/
```

## What are the common mistakes?

- ...

See [the cluster pillar](/blog/playwright-python-guide), [a related post](/blog/related-slug) and [another related post](/blog/another-slug).
```

## 9. Publishing checklist

1. The example project passes; `testedWith` matches it.
2. No visible `[ADD YOUR EXPERIENCE` text is left.
3. Set `draft: false` and `dateModified`.
4. `npm run build` passes (the lint runs first).
5. After the deploy is live: `npm run indexnow -- --send https://blog.dipakbist.com.np/blog/<slug>` (Bing and other IndexNow engines), and "Request indexing" for the URL in Google Search Console.
6. The sitemap and RSS feed update on their own.

## 10. Structured data

The page adds `BlogPosting` (author and publisher: Dipak Bist, `https://dipakbist.com.np/#person`) and `BreadcrumbList` to every post, and `Blog` to the home page. No `FAQPage` or `HowTo` markup: Google no longer shows those rich results for sites like this one, and the visible FAQ is what readers and AI tools use.

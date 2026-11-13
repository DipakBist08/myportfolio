/**
 * Tests for scripts/seo-lint.mjs. Run: npm run test:seo
 *
 * Each test writes a tiny blog (posts plus an app/ and public/ folder) into a
 * temporary directory, lints it, and checks which rule fired.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lintBlog } from './seo-lint.mjs'

const CLUSTERS = [
  { slug: 'testing', name: 'Testing', category: 'Testing', pillarSlug: 'testing-guide', intro: '' },
  { slug: 'other', name: 'Other', category: 'Other', pillarSlug: 'other-guide', intro: '' },
]

const SECTIONS = [{ label: 'Automation', categories: ['Testing'], intro: '' }, { label: 'AI Lab' }]

const sentence = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
const description = (seed) => `${seed} `.padEnd(150, 'x')
const FAQ = [1, 2, 3].map((i) => ({ q: `Question ${i}?`, a: sentence(45) }))

/** A post that passes every rule unless an option changes it. */
function post(slug, options = {}) {
  const fm = {
    title: options.title ?? `Post about ${slug}`,
    description: options.description ?? description(slug),
    slug: options.slugField ?? slug,
    primaryQuery: options.primaryQuery ?? `${slug} query`,
    secondaryQueries: [],
    cluster: options.cluster ?? 'testing',
    isPillar: options.isPillar ?? false,
    datePublished: '2026-01-01',
    dateModified: '2026-02-01',
    draft: options.draft ?? false,
    category: options.category ?? 'Testing',
    tags: ['QA'],
    author: 'Dipak Bist',
    excerpt: 'An excerpt.',
    faq: options.faq ?? FAQ,
    ...(options.testedWith ? { testedWith: options.testedWith } : {}),
  }
  for (const key of options.omit ?? []) delete fm[key]

  const yaml = Object.entries(fm)
    .map(([k, v]) => {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        return `${k}:\n${v.map((item) => `  - q: ${JSON.stringify(item.q)}\n    a: ${JSON.stringify(item.a)}`).join('\n')}`
      }
      return `${k}: ${JSON.stringify(v)}`
    })
    .join('\n')

  const links = options.links ?? ['/blog/category/testing', '/about', '/contact']
  const body =
    options.body ??
    [
      `${sentence(30)}.`,
      '',
      '<KeyTakeaways>\n- One.\n</KeyTakeaways>',
      '',
      '## First section',
      '',
      links.map((l, i) => `See [descriptive link ${i}](${l}).`).join(' '),
      '',
      options.extra ?? '',
    ].join('\n')

  return `---\n${yaml}\n---\n\n${body}\n`
}

function blog(posts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-lint-'))
  const contentDir = path.join(dir, 'content')
  const appDir = path.join(dir, 'app')
  const publicDir = path.join(dir, 'public')
  for (const d of [contentDir, path.join(appDir, 'about'), path.join(appDir, 'contact'), publicDir]) fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(appDir, 'about', 'page.tsx'), '')
  fs.writeFileSync(path.join(appDir, 'contact', 'page.tsx'), '')
  for (const [slug, source] of Object.entries(posts)) fs.writeFileSync(path.join(contentDir, `${slug}.mdx`), source)
  return lintBlog({ contentDir, appDir, publicDir, clusters: CLUSTERS, sections: SECTIONS, today: '2026-11-12' })
}

const codes = (report, slug, level = 'errors') => report.results.find((r) => r.slug === slug)[level].map((e) => e.code)

test('a complete post passes', () => {
  const report = blog({ alpha: post('alpha') })
  assert.equal(report.errorCount, 0, JSON.stringify(report.results, null, 2))
})

test('missing front matter fails', () => {
  const report = blog({ alpha: post('alpha', { omit: ['primaryQuery', 'dateModified'] }) })
  assert.ok(codes(report, 'alpha').includes('frontmatter'))
})

test('slug must match the file name', () => {
  const report = blog({ alpha: post('alpha', { slugField: 'beta' }) })
  assert.ok(codes(report, 'alpha').includes('slug'))
})

test('a title over 65 characters with the suffix fails', () => {
  const report = blog({ alpha: post('alpha', { title: 'T'.repeat(53) }) }) // 53 + 13 = 66
  assert.ok(codes(report, 'alpha').includes('title-length'))
  const ok = blog({ alpha: post('alpha', { title: 'T'.repeat(52) }) }) // exactly 65
  assert.ok(!codes(ok, 'alpha').includes('title-length'))
})

test('a description outside 140 to 160 characters fails', () => {
  assert.ok(codes(blog({ alpha: post('alpha', { description: 'Too short.' }) }), 'alpha').includes('description-length'))
  assert.ok(codes(blog({ alpha: post('alpha', { description: 'x'.repeat(161) }) }), 'alpha').includes('description-length'))
})

test('an H1 in the body fails (the page renders the only H1)', () => {
  const report = blog({ alpha: post('alpha', { extra: '# Another title' }) })
  assert.ok(codes(report, 'alpha').includes('h1'))
})

test('a "#" line inside a code block is not a heading', () => {
  const report = blog({ alpha: post('alpha', { extra: '```text\n# not a heading\n```', testedWith: undefined }) })
  assert.ok(!codes(report, 'alpha').includes('h1'))
})

test('fewer than 3 internal links fails', () => {
  const report = blog({ alpha: post('alpha', { links: ['/about', '/contact'] }) })
  assert.ok(codes(report, 'alpha').includes('internal-links'))
})

test('a link to a missing page or anchor fails', () => {
  const missingPage = blog({ alpha: post('alpha', { extra: 'See [the missing post](/blog/nope).' }) })
  assert.ok(codes(missingPage, 'alpha').includes('broken-link'))
  const missingAnchor = blog({ alpha: post('alpha', { extra: 'See [a section](#not-there).' }) })
  assert.ok(codes(missingAnchor, 'alpha').includes('broken-link'))
  const goodAnchor = blog({ alpha: post('alpha', { extra: 'See [the first section](#first-section).' }) })
  assert.ok(!codes(goodAnchor, 'alpha').includes('broken-link'))
})

test('a published post may not link to a draft', () => {
  const report = blog({
    alpha: post('alpha', { extra: 'See [the beta post](/blog/beta).' }),
    beta: post('beta', { draft: true }),
  })
  assert.ok(codes(report, 'alpha').includes('broken-link'))
})

test('an image without alt text fails', () => {
  const report = blog({ alpha: post('alpha', { extra: '![](/diagram.webp)' }) })
  assert.ok(codes(report, 'alpha').includes('image-alt'))
  const figure = blog({ alpha: post('alpha', { extra: '<Figure src="/a.webp" alt="" />' }) })
  assert.ok(codes(figure, 'alpha').includes('image-alt'))
})

test('duplicate titles and primary queries across published posts fail', () => {
  const report = blog({
    alpha: post('alpha', { title: 'Same title', primaryQuery: 'same query' }),
    beta: post('beta', { title: 'Same title', primaryQuery: 'same query' }),
  })
  assert.ok(codes(report, 'alpha').includes('duplicate-title'))
  assert.ok(codes(report, 'beta').includes('duplicate-primaryQuery'))
})

test('runnable code needs testedWith', () => {
  const code = '```python\nprint("hi")\n```'
  assert.ok(codes(blog({ alpha: post('alpha', { extra: code }) }), 'alpha').includes('tested-with'))
  assert.ok(!codes(blog({ alpha: post('alpha', { extra: code, testedWith: 'Python 3.12' }) }), 'alpha').includes('tested-with'))
})

test('a visible experience placeholder fails a published post, a hidden one only warns', () => {
  const visible = blog({ alpha: post('alpha', { extra: '[ADD YOUR EXPERIENCE: a story]' }) })
  assert.ok(codes(visible, 'alpha').includes('placeholder'))
  const hidden = blog({ alpha: post('alpha', { extra: '{/* [ADD YOUR EXPERIENCE: a story] */}' }) })
  assert.ok(!codes(hidden, 'alpha').includes('placeholder'))
  assert.ok(codes(hidden, 'alpha', 'warnings').includes('placeholder-hidden'))
})

test('a draft never fails the build: its problems become warnings', () => {
  const report = blog({ alpha: post('alpha', { draft: true, title: 'T'.repeat(80), extra: '[ADD YOUR EXPERIENCE: later]' }) })
  assert.equal(report.errorCount, 0)
  assert.ok(codes(report, 'alpha', 'warnings').includes('title-length'))
  assert.ok(codes(report, 'alpha', 'warnings').includes('placeholder'))
})

test('once the pillar is published, a spoke must link to it and the pillar to every spoke', () => {
  const report = blog({
    'testing-guide': post('testing-guide', { isPillar: true }),
    alpha: post('alpha'),
  })
  assert.ok(codes(report, 'alpha').includes('pillar-link'))
  assert.ok(codes(report, 'testing-guide').includes('pillar-spokes'))

  const linked = blog({
    'testing-guide': post('testing-guide', { isPillar: true, links: ['/blog/alpha', '/about', '/contact'] }),
    alpha: post('alpha', { links: ['/blog/testing-guide', '/about', '/contact'] }),
  })
  assert.equal(linked.errorCount, 0, JSON.stringify(linked.results, null, 2))
})

test('before the pillar exists, a missing pillar link is only a warning', () => {
  const report = blog({ alpha: post('alpha') })
  assert.ok(codes(report, 'alpha', 'warnings').includes('pillar-link'))
  assert.ok(!codes(report, 'alpha').includes('pillar-link'))
})

test('an FAQ needs 3 to 5 questions', () => {
  const report = blog({ alpha: post('alpha', { faq: FAQ.slice(0, 2) }) })
  assert.ok(codes(report, 'alpha').includes('faq'))
})

test('an unknown cluster fails', () => {
  const report = blog({ alpha: post('alpha', { cluster: 'nope' }) })
  assert.ok(codes(report, 'alpha').includes('cluster'))
})

test('a link to a menu section hub is valid, even before the section has posts', () => {
  const report = blog({ alpha: post('alpha', { extra: 'See [automation articles](/blog/category/automation) and [the AI Lab](/blog/category/ai-lab).' }) })
  assert.ok(!codes(report, 'alpha').includes('broken-link'), JSON.stringify(report.results, null, 2))
  const unknown = blog({ alpha: post('alpha', { extra: 'See [nothing](/blog/category/no-such-section).' }) })
  assert.ok(codes(unknown, 'alpha').includes('broken-link'))
})

#!/usr/bin/env node
/**
 * SEO lint for the blog posts in content/blog/*.mdx.
 *
 * Runs before `next build` (see package.json) and stops the build when a
 * PUBLISHED post breaks the standard in docs/POST_TEMPLATE.md. Drafts are
 * checked too, but their problems are printed as warnings, so work in
 * progress never blocks a deploy.
 *
 *   node scripts/seo-lint.mjs            lint content/blog
 *   node scripts/seo-lint.mjs --strict   treat warnings as errors too
 *
 * Exit code 1 when there is at least one error.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import matter from 'gray-matter'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const RULES = {
  titleSuffix: ' | Dipak Bist',
  titleMax: 65, // the whole <title>, suffix included
  descriptionMin: 140,
  descriptionMax: 160,
  minInternalLinks: 3,
  faqMin: 3,
  faqMax: 5,
  faqWordsMin: 40,
  faqWordsMax: 60,
  introWordsMin: 20,
  author: 'Dipak Bist',
}

const BASE_URL = 'https://blog.dipakbist.com.np'
const PLACEHOLDER = '[ADD YOUR EXPERIENCE'
const FAQ_HEADING_ID = 'frequently-asked-questions'

/* Fences in these languages hold code a reader will run, so the post must say
   which versions it was tested with. Templates, plain text and data are not. */
const RUNNABLE = new Set([
  'python', 'py', 'bash', 'sh', 'shell', 'zsh', 'console', 'powershell', 'ps1',
  'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'java', 'csharp', 'cs',
  'yaml', 'yml', 'gherkin', 'feature', 'groovy', 'sql',
])

const GENERIC_LINK_TEXT = new Set([
  'here', 'click here', 'this', 'link', 'this link', 'read more', 'more',
  'this post', 'this article', 'this page', 'see here',
])

const FENCE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm
const MDX_COMMENT = /\{\/\*[\s\S]*?\*\/\}/g
const INLINE_CODE = /`[^`\n]+`/g
const MD_LINK = /(?<!!)\[([^\]\n]+)\]\(\s*([^)\s]+)(?:\s+["'][^"'\n]*["'])?\s*\)/g
const HREF = /\bhref=(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})/g
const MD_IMAGE = /!\[([^\]\n]*)\]\(\s*([^)\s]+)[^)]*\)/g

/* ---------- small helpers ---------- */

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length

export function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/* Same ids as rehype-slug (github-slugger); kept in step with lib/blog/utils.ts. */
const SLUG_REMOVE = new RegExp('[^\\p{L}\\p{M}\\p{N}\\p{Pc}\\- ]', 'gu')
function headingId(text, seen) {
  const base = text.toLowerCase().replace(SLUG_REMOVE, '').replace(/ /g, '-')
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

const headingText = (raw) =>
  raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .trim()

function toDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) return value
  return null
}

function walk(dir, visit) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      visit(full, true)
      walk(full, visit)
    } else {
      visit(full, false)
    }
  }
}

/** Routes that exist without a post behind them: app/**\/page.tsx, route handlers, public files. */
function knownRoutes(appDir, publicDir) {
  const routes = new Set(['/', '/rss.xml', '/sitemap.xml', '/robots.txt'])
  walk(appDir, (full, isDir) => {
    if (!isDir) return
    const segments = path.relative(appDir, full).split(path.sep)
    if (segments.some((s) => s.startsWith('['))) return
    const files = fs.readdirSync(full)
    if (!files.some((f) => /^(page|route)\.(t|j)sx?$/.test(f) || f === 'page.mdx')) return
    routes.add('/' + segments.filter((s) => !(s.startsWith('(') && s.endsWith(')'))).join('/'))
  })
  walk(publicDir, (full, isDir) => {
    if (!isDir) routes.add('/' + path.relative(publicDir, full).split(path.sep).join('/'))
  })
  return routes
}

/* ---------- reading a post ---------- */

function readPost(file) {
  const slug = path.basename(file, '.mdx')
  const raw = fs.readFileSync(file, 'utf-8')
  let parsed
  try {
    parsed = matter(raw)
  } catch (error) {
    return { file, slug, data: {}, body: '', parseError: error.message }
  }

  const body = parsed.content
  const fences = [...body.matchAll(FENCE)]
  const withoutCode = body.replace(FENCE, '').replace(INLINE_CODE, '')
  const comments = withoutCode.match(MDX_COMMENT) ?? []
  const visible = withoutCode.replace(MDX_COMMENT, '')

  const languages = fences.map((m) => m[0].split('\n')[0].replace(/^(```|~~~)/, '').trim().split(/\s+/)[0].toLowerCase())

  const headingIds = new Set()
  const seen = new Map()
  let h1 = 0
  let firstH2Index = -1
  for (const m of visible.matchAll(/^(#{1,6})\s+(.+)$/gm)) {
    if (m[1].length === 1) h1 += 1
    if (m[1].length === 2 && firstH2Index === -1) firstH2Index = m.index
    headingIds.add(headingId(headingText(m[2]), seen))
  }
  h1 += (visible.match(/<h1\b/gi) ?? []).length
  if (Array.isArray(parsed.data.faq) && parsed.data.faq.length) headingIds.add(FAQ_HEADING_ID)

  const links = []
  for (const m of visible.matchAll(MD_LINK)) links.push({ text: m[1].replace(/[*_`]/g, '').trim(), url: m[2] })
  for (const m of visible.matchAll(HREF)) links.push({ text: null, url: m[1] ?? m[2] ?? m[3] })

  const images = []
  for (const m of visible.matchAll(MD_IMAGE)) images.push({ alt: m[1].trim(), src: m[2], kind: 'markdown' })
  for (const m of visible.matchAll(/<img\b[^>]*>/gi)) {
    const alt = m[0].match(/\balt=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/)
    images.push({ alt: alt ? (alt[1] ?? alt[2] ?? alt[3] ?? '').trim() : '', src: (m[0].match(/\bsrc=["']([^"']+)/) ?? [])[1], kind: '<img>' })
  }
  for (const m of visible.matchAll(/<Figure\b[\s\S]*?\/?>/g)) {
    const alt = m[0].match(/\balt=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/)
    images.push({ alt: alt ? (alt[1] ?? alt[2] ?? alt[3] ?? '').trim() : '', src: (m[0].match(/\bsrc=["']([^"']+)/) ?? [])[1], kind: '<Figure>' })
  }

  const intro = firstH2Index === -1 ? visible : visible.slice(0, firstH2Index)
  const introText = intro
    .replace(/<KeyTakeaways\b[\s\S]*?<\/KeyTakeaways>/g, '')
    .replace(/<[A-Z][\s\S]*?\/>/g, '')
    .replace(/<[^>]+>/g, '')

  return {
    file,
    slug,
    data: parsed.data,
    body,
    visible,
    comments,
    languages,
    headingIds,
    h1,
    links,
    images,
    introWords: words(introText),
    hasKeyTakeaways: /<KeyTakeaways\b/.test(visible),
  }
}

function toInternal(url) {
  let u = url
  if (u.startsWith(BASE_URL)) u = u.slice(BASE_URL.length) || '/'
  if (u.startsWith('#')) return { path: null, hash: u.slice(1) }
  if (!u.startsWith('/') || u.startsWith('//')) return null
  const [pathAndQuery, hash = ''] = u.split('#')
  let p = pathAndQuery.split('?')[0]
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return { path: p, hash: decodeURIComponent(hash) }
}

/* ---------- the lint ---------- */

/**
 * Lint every post. Returns per-post errors and warnings; never exits.
 * Paths default to this blog; tests pass their own.
 */
export function lintBlog({
  contentDir = path.join(ROOT, 'content', 'blog'),
  appDir = path.join(ROOT, 'app'),
  publicDir = path.join(ROOT, 'public'),
  clusters = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'blog', 'clusters.json'), 'utf-8')),
  sections = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'blog', 'sections.json'), 'utf-8')),
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const files = fs.existsSync(contentDir)
    ? fs.readdirSync(contentDir).filter((f) => f.endsWith('.mdx')).sort().map((f) => path.join(contentDir, f))
    : []
  const posts = files.map(readPost)
  const results = posts.map((p) => ({ file: p.file, slug: p.slug, draft: p.data.draft === true, errors: [], warnings: [] }))
  const resultOf = new Map(results.map((r) => [r.slug, r]))

  const ok = posts.filter((p) => !p.parseError)
  const published = ok.filter((p) => p.data.draft !== true)
  const publishedSlugs = new Set(published.map((p) => p.slug))
  const allSlugs = new Set(ok.map((p) => p.slug))
  // Category pages: every category with a published post, plus every menu
  // section (lib/blog/sections.json), which has a page even before it has posts.
  const categories = new Set([...published.map((p) => slugify(p.data.category ?? '')), ...sections.map((s) => slugify(s.label))])
  const tags = new Set(published.flatMap((p) => (Array.isArray(p.data.tags) ? p.data.tags : []).map(slugify)))
  const headingIdsBySlug = new Map(ok.map((p) => [p.slug, p.headingIds]))
  const routes = knownRoutes(appDir, publicDir)
  const clusterBySlug = new Map(clusters.map((c) => [c.slug, c]))

  for (const post of posts) {
    const result = resultOf.get(post.slug)
    const isDraft = result.draft
    // Problems in a draft never stop a build: they are shown as warnings.
    const error = (code, message) => (isDraft ? result.warnings : result.errors).push({ code, message })
    const warn = (code, message) => result.warnings.push({ code, message })

    if (post.parseError) {
      result.errors.push({ code: 'frontmatter', message: `Front matter could not be parsed: ${post.parseError}` })
      continue
    }

    const d = post.data

    /* Front matter */
    const strings = ['title', 'description', 'slug', 'primaryQuery', 'cluster', 'category', 'author', 'excerpt']
    for (const key of strings) {
      if (typeof d[key] !== 'string' || !d[key].trim()) error('frontmatter', `Missing or empty "${key}".`)
    }
    for (const key of ['isPillar', 'draft']) {
      if (typeof d[key] !== 'boolean') error('frontmatter', `"${key}" must be true or false.`)
    }
    if (!Array.isArray(d.secondaryQueries) || d.secondaryQueries.some((q) => typeof q !== 'string')) {
      error('frontmatter', '"secondaryQueries" must be a list of strings (it can be empty).')
    }
    if (!Array.isArray(d.tags) || d.tags.length === 0) error('frontmatter', '"tags" must be a non-empty list.')

    const published_ = toDay(d.datePublished)
    const modified = toDay(d.dateModified)
    if (!published_) error('frontmatter', '"datePublished" must be a date in YYYY-MM-DD form.')
    if (!modified) error('frontmatter', '"dateModified" must be a date in YYYY-MM-DD form.')
    if (published_ && modified && modified < published_) error('dates', `dateModified (${modified}) is before datePublished (${published_}).`)
    if (modified && modified > today) warn('dates', `dateModified (${modified}) is in the future.`)

    if (typeof d.slug === 'string' && d.slug !== post.slug) {
      error('slug', `"slug" is "${d.slug}" but the file is ${post.slug}.mdx. They must match (the file name is the URL).`)
    }

    const cluster = clusterBySlug.get(d.cluster)
    if (typeof d.cluster === 'string' && !cluster) {
      error('cluster', `Unknown cluster "${d.cluster}". Known: ${[...clusterBySlug.keys()].join(', ')}.`)
    }
    if (cluster && d.category && d.category !== cluster.category) {
      warn('cluster-category', `Category "${d.category}" is not the ${cluster.name} hub ("${cluster.category}"), so the post is missing from that hub page.`)
    }
    if (d.author && d.author !== RULES.author) warn('author', `Author is "${d.author}"; every post uses "${RULES.author}".`)

    if (!Array.isArray(d.faq) || d.faq.length < RULES.faqMin || d.faq.length > RULES.faqMax) {
      error('faq', `"faq" needs ${RULES.faqMin} to ${RULES.faqMax} questions (has ${Array.isArray(d.faq) ? d.faq.length : 0}).`)
    }
    if (Array.isArray(d.faq)) {
      d.faq.forEach((item, i) => {
        if (!item || typeof item.q !== 'string' || typeof item.a !== 'string' || !item.q.trim() || !item.a.trim()) {
          error('faq', `FAQ item ${i + 1} needs both "q" and "a".`)
          return
        }
        const n = words(item.a)
        if (n < RULES.faqWordsMin || n > RULES.faqWordsMax) {
          warn('faq-length', `FAQ answer ${i + 1} is ${n} words; aim for ${RULES.faqWordsMin} to ${RULES.faqWordsMax}: "${item.q}"`)
        }
      })
    }

    /* Title and description */
    if (typeof d.title === 'string') {
      if (d.title.endsWith(RULES.titleSuffix.trim()) || d.title.includes(' | ')) {
        error('title', `Leave "${RULES.titleSuffix.trim()}" out of "title"; the site adds it.`)
      }
      const full = `${d.title}${RULES.titleSuffix}`
      if (full.length > RULES.titleMax) {
        error('title-length', `Title is ${full.length} characters with "${RULES.titleSuffix}" (max ${RULES.titleMax}): "${full}"`)
      }
    }
    if (typeof d.description === 'string') {
      const n = d.description.length
      if (n < RULES.descriptionMin || n > RULES.descriptionMax) {
        error('description-length', `Description is ${n} characters (needs ${RULES.descriptionMin} to ${RULES.descriptionMax}).`)
      }
    }

    /* Structure */
    if (post.h1 > 0) error('h1', `The post body has ${post.h1} H1 heading(s). The page already renders the title as the only H1; start sections at ##.`)
    if (!post.hasKeyTakeaways) warn('key-takeaways', 'No <KeyTakeaways> box after the intro.')
    if (post.introWords < RULES.introWordsMin) warn('intro', `The intro before the first ## heading is ${post.introWords} words; answer the main question there in 2 to 3 sentences.`)

    const runnable = post.languages.filter((l) => RUNNABLE.has(l))
    if (runnable.length && (typeof d.testedWith !== 'string' || !d.testedWith.trim())) {
      error('tested-with', `The post has ${runnable.length} runnable code block(s) (${[...new Set(runnable)].join(', ')}) but no "testedWith".`)
    }

    /* Placeholders and unfinished text */
    if (post.visible.includes(PLACEHOLDER) || JSON.stringify(d).includes(PLACEHOLDER)) {
      error('placeholder', `Visible "${PLACEHOLDER}...]" text. Fill it in or remove it before publishing.`)
    }
    const hidden = post.comments.filter((c) => c.includes(PLACEHOLDER)).length
    if (hidden) warn('placeholder-hidden', `${hidden} hidden experience note(s) in MDX comments are waiting to be written (readers cannot see them).`)
    if (/\bcoming soon\b/i.test(post.visible)) warn('coming-soon', '"Coming soon" text: finish the section or remove it.')

    /* Images */
    for (const img of post.images) {
      if (!img.alt) error('image-alt', `${img.kind} image ${img.src ?? ''} has no alt text.`)
      if (img.src && img.src.startsWith('/') && !/\.(webp|svg|avif)$/i.test(img.src)) warn('image-format', `Local image ${img.src} is not WebP (or SVG/AVIF).`)
    }

    /* Links */
    const internalTargets = new Set()
    for (const link of post.links) {
      if (link.text !== null && GENERIC_LINK_TEXT.has(link.text.toLowerCase())) {
        warn('link-text', `Link text "${link.text}" says nothing about the target (${link.url}).`)
      }
      const target = toInternal(link.url)
      if (!target) continue

      if (target.path === null) {
        if (target.hash && !post.headingIds.has(target.hash)) error('broken-link', `Anchor #${target.hash} does not match any heading in this post.`)
        continue
      }

      const p = target.path
      let exists = routes.has(p)
      let anchorIds = null
      const postMatch = p.match(/^\/blog\/([^/]+)$/)
      const categoryMatch = p.match(/^\/blog\/category\/([^/]+)$/)
      const tagMatch = p.match(/^\/blog\/tag\/([^/]+)$/)
      const ogMatch = p.match(/^\/og\/([^/]+)$/)
      if (postMatch) {
        const slug = postMatch[1]
        exists = publishedSlugs.has(slug) || (isDraft && allSlugs.has(slug))
        if (!exists && allSlugs.has(slug)) {
          error('broken-link', `${p} is a draft, so the link is broken once this post is published.`)
          continue
        }
        anchorIds = headingIdsBySlug.get(slug)
      } else if (categoryMatch) {
        exists = categories.has(categoryMatch[1])
      } else if (tagMatch) {
        exists = tags.has(tagMatch[1])
      } else if (ogMatch) {
        exists = publishedSlugs.has(ogMatch[1])
      }

      if (!exists) {
        error('broken-link', `Internal link ${link.url} does not resolve to a page.`)
        continue
      }
      if (target.hash && anchorIds && !anchorIds.has(target.hash)) {
        error('broken-link', `Anchor #${target.hash} does not exist on ${p}.`)
      }
      if (postMatch && postMatch[1] === post.slug) continue
      internalTargets.add(p)
    }

    if (internalTargets.size < RULES.minInternalLinks) {
      error('internal-links', `${internalTargets.size} internal link target(s); needs at least ${RULES.minInternalLinks} (the cluster pillar plus 2 related posts).`)
    }

    if (cluster && !d.isPillar) {
      const pillarPath = `/blog/${cluster.pillarSlug}`
      if (publishedSlugs.has(cluster.pillarSlug)) {
        if (!internalTargets.has(pillarPath)) error('pillar-link', `No link to the ${cluster.name} pillar (${pillarPath}).`)
      } else {
        warn('pillar-link', `The ${cluster.name} pillar (${pillarPath}) is not published yet. Link to it once it is.`)
      }
    }
    if (cluster && d.isPillar) {
      if (post.slug !== cluster.pillarSlug) {
        error('pillar', `isPillar is true, but the ${cluster.name} pillar slug in lib/blog/clusters.json is "${cluster.pillarSlug}".`)
      }
      for (const spoke of published) {
        if (spoke.slug === post.slug || spoke.data.cluster !== cluster.slug) continue
        if (!internalTargets.has(`/blog/${spoke.slug}`)) error('pillar-spokes', `The pillar does not link to its spoke /blog/${spoke.slug}.`)
      }
    }
  }

  /* Duplicates across published posts: a repeated title, description or target query competes with itself. */
  for (const [key, label] of [['title', 'title'], ['description', 'description'], ['primaryQuery', 'primary query']]) {
    const seen = new Map()
    for (const p of published) {
      const value = typeof p.data[key] === 'string' ? p.data[key].trim().toLowerCase() : ''
      if (!value) continue
      if (!seen.has(value)) seen.set(value, [])
      seen.get(value).push(p.slug)
    }
    for (const slugs of seen.values()) {
      if (slugs.length < 2) continue
      for (const slug of slugs) {
        resultOf.get(slug).errors.push({ code: `duplicate-${key}`, message: `Same ${label} as ${slugs.filter((s) => s !== slug).join(', ')}.` })
      }
    }
  }

  return {
    results,
    errorCount: results.reduce((n, r) => n + r.errors.length, 0),
    warningCount: results.reduce((n, r) => n + r.warnings.length, 0),
    publishedCount: published.length,
    draftCount: ok.length - published.length,
  }
}

/* ---------- command line ---------- */

function main() {
  const strict = process.argv.includes('--strict')
  const report = lintBlog()
  const rel = (f) => path.relative(ROOT, f)

  console.log(`SEO lint: ${report.results.length} posts (${report.publishedCount} published, ${report.draftCount} drafts)\n`)
  for (const r of report.results) {
    const failed = r.errors.length > 0 || (strict && r.warnings.length > 0)
    console.log(`${failed ? '✖' : '✔'} ${rel(r.file)}${r.draft ? '  (draft: problems shown as warnings)' : ''}`)
    for (const e of r.errors) console.log(`    error    ${e.code.padEnd(20)} ${e.message}`)
    for (const w of r.warnings) console.log(`    warning  ${w.code.padEnd(20)} ${w.message}`)
  }

  const failing = report.errorCount + (strict ? report.warningCount : 0)
  console.log(`\n${report.errorCount} error(s), ${report.warningCount} warning(s).`)
  if (failing > 0) {
    console.log('Build stopped. Fix the errors above; the standard is in docs/POST_TEMPLATE.md.')
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()

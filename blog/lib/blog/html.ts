/**
 * Rich-text CMS posts arrive as HTML. Before it reaches the page it is
 * sanitised again here (the CMS already cleans it with bleach on save; this is
 * the second layer), then given the same heading ids, heading links and code
 * highlighting that MDX posts get. The headings are collected for the table of
 * contents in the same pass, so the contents links always match the ids.
 */
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeStringify from 'rehype-stringify'
import type { Heading } from './utils'

interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

// GitHub's allowlist, minus author-set ids and names: rehype-slug gives every
// heading its id afterwards, the same way it does for MDX posts.
const schema = {
  ...defaultSchema,
  clobber: [],
  attributes: {
    ...defaultSchema.attributes,
    '*': (defaultSchema.attributes?.['*'] ?? []).filter((a) => a !== 'id' && a !== 'name'),
  },
}

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

function collectHeadings(into: Heading[]) {
  return () => (tree: HastNode) => {
    const walk = (node: HastNode) => {
      const level = node.tagName && /^h[23]$/.test(node.tagName) ? Number(node.tagName[1]) : 0
      const id = node.properties?.id
      if (level && typeof id === 'string') into.push({ id, text: textOf(node).trim(), level })
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

export async function renderCmsHtml(html: string): Promise<{ html: string; headings: Heading[] }> {
  const headings: Heading[] = []
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, schema)
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(rehypeAutolinkHeadings, { behavior: 'wrap', properties: { className: ['anchor'] } })
    .use(rehypePrettyCode, { theme: 'github-dark-default', keepBackground: true })
    .use(rehypeStringify)
    .process(html)
  return { html: String(file), headings }
}

import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import { getMDXComponents } from './MDXComponents'
import { remarkAdSlots } from '@/lib/blog/remarkAdSlots'

interface MDXContentProps {
  source: string
  /** CMS posts: on an MDX error, show the body as plain Markdown instead of failing. */
  fallbackToMarkdown?: boolean
}

const rehypePrettyCodeOptions = {
  theme: 'github-dark-default',
  keepBackground: true,
  onVisitLine(node: { children: { type: string }[] }) {
    // Prevent lines from collapsing in `display: grid` mode
    if (node.children.length === 0) {
      node.children = [{ type: 'text' }]
    }
  },
  onVisitHighlightedLine(node: { properties: { className: string[] } }) {
    node.properties.className = node.properties.className ?? []
    node.properties.className.push('highlighted')
  },
  onVisitHighlightedChars(node: { properties: { className: string[] } }) {
    node.properties.className = ['word']
  },
}

const PROSE =
  'prose max-w-none prose-headings:font-heading prose-headings:scroll-mt-20 prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0'

function mdxOptions(format: 'mdx' | 'md') {
  return {
    mdxOptions: {
      format,
      remarkPlugins: [remarkGfm, remarkAdSlots],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'wrap', properties: { className: ['anchor'] } }],
        [rehypePrettyCode, rehypePrettyCodeOptions],
      ],
    },
    // Allow JSX prop expressions like items={[...]} in MDX content...
    blockJS: false,
    // ...but strip dangerous ones (eval, Function, process, require,
    // import...). MDX can come from the CMS now, not only from files.
    blockDangerousJS: true,
  } as const
}

/**
 * An MDX body. Files are trusted to compile (the build fails if one does not).
 * A CMS post with an MDX mistake (an unclosed tag, a stray `{`, or code that
 * blockDangerousJS refuses) is shown as plain Markdown instead of failing the
 * page: its text stays readable, its components are not rendered, nothing runs.
 */
export default async function MDXContent({ source, fallbackToMarkdown = false }: MDXContentProps) {
  const components = getMDXComponents()
  let content
  try {
    ;({ content } = await compileMDX({ source, components, options: mdxOptions('mdx') as never }))
  } catch (err) {
    if (!fallbackToMarkdown) throw err
    console.error(`[mdx] shown as plain Markdown: ${err instanceof Error ? err.message.split('\n')[0] : err}`)
    ;({ content } = await compileMDX({ source, components, options: mdxOptions('md') as never }))
  }
  return <div className={PROSE}>{content}</div>
}

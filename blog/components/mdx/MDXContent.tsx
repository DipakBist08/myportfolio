import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import { getMDXComponents } from './MDXComponents'

interface MDXContentProps {
  source: string
}

const rehypePrettyCodeOptions = {
  theme: 'github-dark',
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

export default function MDXContent({ source }: MDXContentProps) {
  return (
    <div className="prose max-w-none prose-headings:font-heading prose-headings:scroll-mt-20 prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0">
      <MDXRemote
        source={source}
        components={getMDXComponents()}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              rehypeSlug,
              [
                rehypeAutolinkHeadings,
                {
                  behavior: 'wrap',
                  properties: { className: ['anchor'] },
                },
              ],
              [rehypePrettyCode, rehypePrettyCodeOptions],
            ],
          },
          // Allow JSX prop expressions like items={[...]} in MDX content
          blockJS: false,
        }}
      />
    </div>
  )
}

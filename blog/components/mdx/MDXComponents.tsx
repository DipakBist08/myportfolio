import type { MDXComponents } from 'mdx/types'
import CodeBlock, { PreWithCopy } from './CodeBlock'
import Callout from './Callout'
import QAChecklist from './QAChecklist'
import BugReport from './BugReport'
import TestCase from './TestCase'
import APIRequest from './APIRequest'
import PromptBlock from './PromptBlock'
import CommandBlock from './CommandBlock'
import Figure from './Figure'
import Steps from './Steps'
import Badge from './Badge'
import KeyTakeaways from './KeyTakeaways'
import AdSlot from '@/components/ads/AdSlot'
import Link from 'next/link'

/**
 * Custom MDX component registry.
 * These components are available in all .mdx files.
 */
export function getMDXComponents(overrides?: MDXComponents): MDXComponents {
  return {
    // HTML element overrides
    a: ({ href, children, ...props }) => {
      if (href?.startsWith('/')) {
        return (
          <Link href={href} className="text-primary-light hover:text-primary transition-colors underline underline-offset-2" {...props}>
            {children}
          </Link>
        )
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-light hover:text-primary transition-colors underline underline-offset-2"
          {...props}
        >
          {children}
        </a>
      )
    },

    // Images in post bodies sit below the fold: load lazily. Alt text is
    // required by scripts/seo-lint.mjs, so it is passed through as written.
    img: ({ alt, ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt ?? ''} loading="lazy" decoding="async" {...props} />
    ),

    // Pre tag: wrap with copy button
    pre: PreWithCopy,

    // Heading anchors
    h2: ({ children, id, ...props }) => (
      <h2 id={id} className="group scroll-mt-20" {...props}>
        {children}
        {id && (
          <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-100 text-primary/50 hover:text-primary text-base no-underline transition-opacity" aria-label="Link to section">
            #
          </a>
        )}
      </h2>
    ),

    h3: ({ children, id, ...props }) => (
      <h3 id={id} className="group scroll-mt-20" {...props}>
        {children}
        {id && (
          <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-100 text-primary/50 hover:text-primary text-sm no-underline transition-opacity" aria-label="Link to section">
            #
          </a>
        )}
      </h3>
    ),

    // Blockquote
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="my-5 border-l-2 border-primary pl-5 not-italic text-muted"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Table
    table: ({ children, ...props }) => (
      <div className="my-5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm" {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="border-b border-line bg-[rgb(var(--ink-rgb)/0.04)]" {...props}>{children}</thead>
    ),
    th: ({ children, ...props }) => (
      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border-t border-line px-4 py-2.5 text-ink/90" {...props}>
        {children}
      </td>
    ),

    // Horizontal rule
    hr: (props) => <hr className="my-8 border-slate-700/50" {...props} />,

    // Custom QA components - available as JSX in MDX files
    CodeBlock,
    Callout,
    QAChecklist,
    BugReport,
    TestCase,
    APIRequest,
    PromptBlock,
    CommandBlock,
    Figure,
    Steps,
    Badge,
    KeyTakeaways,
    // Inserted by lib/blog/remarkAdSlots.ts, never written by hand in a post.
    AdSlot,

    // Override with any additional components
    ...overrides,
  }
}

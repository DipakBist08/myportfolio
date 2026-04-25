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
        className="border-l-4 border-primary pl-4 italic text-slate-400 light:text-slate-600 my-4"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Table
    table: ({ children, ...props }) => (
      <div className="my-5 overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm" {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-surface-card/60 border-b border-slate-700/50" {...props}>{children}</thead>
    ),
    th: ({ children, ...props }) => (
      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="px-4 py-2.5 text-slate-300 light:text-slate-700 border-t border-slate-700/30" {...props}>
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

    // Override with any additional components
    ...overrides,
  }
}

'use client'

import { useState, useRef } from 'react'

interface CodeBlockProps {
  children: React.ReactNode
  filename?: string
  language?: string
}

export default function CodeBlock({ children, filename, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLDivElement>(null)

  const copy = async () => {
    const text = preRef.current?.querySelector('code')?.textContent ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-4 rounded-xl overflow-hidden border border-slate-700/50">
      {/* Header */}
      {filename && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-card border-b border-slate-700/50">
          <span className="h-3 w-3 rounded-full bg-primary/60 shrink-0" />
          <span className="text-xs font-mono text-slate-400">{filename}</span>
          {language && (
            <span className="ml-auto text-xs text-slate-600 uppercase">{language}</span>
          )}
        </div>
      )}

      {/* Code */}
      <div ref={preRef} className="relative">
        {children}

        {/* Copy button */}
        <button
          onClick={copy}
          aria-label="Copy code"
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-slate-600/50 bg-surface-card/80 px-2.5 py-1.5 text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:border-primary/50 hover:text-primary-light transition-all duration-200"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/** Inline copy wrapper for pre tags rendered by rehype-pretty-code */
export function PreWithCopy({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLPreElement>(null)

  const copy = async () => {
    const text = ref.current?.textContent ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative">
      <pre ref={ref} {...props}>
        {children}
      </pre>
      <button
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-slate-600/50 bg-[#0d1117]/90 px-2.5 py-1.5 text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:border-primary/50 hover:text-primary-light transition-all duration-200"
      >
        {copied ? (
          <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
        {copied ? <span className="text-green-400">Copied!</span> : 'Copy'}
      </button>
    </div>
  )
}

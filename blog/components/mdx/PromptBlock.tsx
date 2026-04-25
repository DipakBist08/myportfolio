'use client'

import { useState } from 'react'

interface PromptBlockProps {
  title?: string
  context?: string
  prompt: string
  tip?: string
}

export default function PromptBlock({ title = 'AI Prompt', context, prompt, tip }: PromptBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-5 rounded-xl border border-secondary/30 bg-secondary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary/20 bg-secondary/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold text-secondary">{title}</span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md border border-secondary/30 bg-surface-card/80 px-2.5 py-1 text-xs text-slate-400 hover:text-secondary transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy Prompt'}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Context */}
        {context && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Context / Role</p>
            <p className="text-sm text-slate-400 italic">{context}</p>
          </div>
        )}

        {/* Prompt */}
        <div className="rounded-lg bg-surface-darker/50 border border-slate-700/50 p-4">
          <p className="whitespace-pre-wrap text-sm text-slate-200 light:text-slate-700 leading-relaxed">{prompt}</p>
        </div>

        {/* Tip */}
        {tip && (
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <span>💡</span>
            <span>{tip}</span>
          </p>
        )}
      </div>
    </div>
  )
}

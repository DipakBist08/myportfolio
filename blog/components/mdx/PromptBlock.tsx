'use client'

import { useState } from 'react'
import { PIcon } from './icons'

interface PromptBlockProps {
  title?: string
  context?: string
  prompt: string
  tip?: string
}

export default function PromptBlock({ title = 'AI prompt', context, prompt, tip }: PromptBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt) } catch { return }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="panel" aria-label={title}>
      <div className="panel-head">
        <p className="panel-title m-0"><PIcon name="chatCenteredText" className="h-4 w-4 text-primary-light" /> {title}</p>
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-md border border-line bg-surface-card px-2.5 text-xs text-muted transition-colors hover:border-primary hover:text-ink light:bg-white"
        >
          <PIcon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy prompt'}
        </button>
      </div>

      <div className="space-y-4 p-4">
        {context && (
          <div>
            <span className="panel-label">Context / role</span>
            <p className="m-0 text-sm text-muted">{context}</p>
          </div>
        )}
        <p className="panel-code m-0 font-sans text-[0.9375rem] leading-relaxed">{prompt}</p>
        {tip && (
          <p className="m-0 flex items-start gap-2 text-sm text-muted">
            <PIcon name="lightbulb" className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" />
            <span>{tip}</span>
          </p>
        )}
      </div>
    </section>
  )
}

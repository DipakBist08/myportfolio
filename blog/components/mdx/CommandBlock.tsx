'use client'

import { useState } from 'react'
import { PIcon } from './icons'

interface CommandBlockProps {
  command: string
  description?: string
  shell?: string
}

export default function CommandBlock({ command, description, shell = 'bash' }: CommandBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(command) } catch { return }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-5 overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-2 border-b border-line bg-[rgb(var(--ink-rgb)/0.03)] px-4 py-2">
        <PIcon name="terminal" className="h-4 w-4 text-muted" />
        <span className="font-mono text-xs text-muted">{shell}</span>
      </div>

      <div className="group relative flex items-start gap-2 bg-[#0d1117] px-4 py-3.5">
        <span className="shrink-0 select-none font-mono text-sm text-[#a5b4fc]" aria-hidden="true">$</span>
        <code className="flex-1 whitespace-pre-wrap break-all font-mono text-sm text-[#e4e4e7]">{command}</code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy command"
          className="ml-2 inline-flex min-h-8 items-center gap-1 rounded-md border border-[rgb(255_255_255/0.14)] bg-[rgb(255_255_255/0.06)] px-2.5 text-xs text-[#d4d4d8] opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <PIcon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {description && (
        <p className="m-0 border-t border-line px-4 py-2 text-xs text-muted">{description}</p>
      )}
    </div>
  )
}

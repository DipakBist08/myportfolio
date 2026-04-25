'use client'

import { useState } from 'react'

interface CommandBlockProps {
  command: string
  description?: string
  shell?: string
}

export default function CommandBlock({ command, description, shell = 'bash' }: CommandBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Shell label */}
      <div className="flex items-center gap-2 border-b border-slate-700/50 bg-surface-card px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/60" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
          <span className="h-3 w-3 rounded-full bg-green-500/60" />
        </div>
        <span className="ml-1 text-xs text-slate-500">{shell}</span>
      </div>

      {/* Command */}
      <div className="group relative flex items-start gap-2 bg-[#0d1117] px-4 py-3.5">
        <span className="text-primary-light font-mono text-sm select-none shrink-0">$</span>
        <code className="flex-1 font-mono text-sm text-slate-200 whitespace-pre-wrap break-all">
          {command}
        </code>
        <button
          onClick={copy}
          aria-label="Copy command"
          className="ml-2 flex items-center gap-1.5 rounded-md border border-slate-700/50 bg-surface-card/80 px-2 py-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:text-primary-light transition-all"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>

      {description && (
        <p className="border-t border-slate-700/50 bg-surface-card/30 px-4 py-2 text-xs text-slate-500">
          {description}
        </p>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'

interface ChecklistItem {
  text: string
  required?: boolean
}

interface QAChecklistProps {
  title?: string
  items: ChecklistItem[] | string[]
}

export default function QAChecklist({ title = 'QA Checklist', items }: QAChecklistProps) {
  const normalizedItems: ChecklistItem[] = items.map((item) =>
    typeof item === 'string' ? { text: item } : item
  )

  const [checked, setChecked] = useState<boolean[]>(normalizedItems.map(() => false))

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  const completed = checked.filter(Boolean).length

  return (
    <div className="my-5 rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20 bg-primary/10">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-primary-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
            <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold text-primary-light">{title}</span>
        </div>
        <span className="text-xs text-slate-400">
          {completed}/{normalizedItems.length}
        </span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-slate-700/50">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
          style={{ width: `${(completed / normalizedItems.length) * 100}%` }}
        />
      </div>

      {/* Items */}
      <ul className="p-4 space-y-2">
        {normalizedItems.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 cursor-pointer group">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  checked[i]
                    ? 'border-primary bg-primary'
                    : 'border-slate-600 group-hover:border-primary/50'
                }`}
                onClick={() => toggle(i)}
              >
                {checked[i] && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span
                className={`text-sm transition-all ${
                  checked[i] ? 'line-through text-slate-500' : 'text-slate-300 light:text-slate-700'
                }`}
              >
                {item.text}
                {item.required && (
                  <span className="ml-1.5 text-xs text-red-400">*required</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

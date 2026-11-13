'use client'

import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PIcon } from './icons'

interface ChecklistItem {
  text: string
  required?: boolean
}

interface QAChecklistProps {
  title?: string
  items: ChecklistItem[] | string[]
}

/* An interactive checklist: real checkboxes, a progress bar that fills as
   the reader ticks items, and a count that reads out the state. */
export default function QAChecklist({ title = 'QA checklist', items }: QAChecklistProps) {
  const normalized: ChecklistItem[] = items.map((item) => (typeof item === 'string' ? { text: item } : item))
  const [checked, setChecked] = useState<boolean[]>(normalized.map(() => false))
  const reduce = useReducedMotion()
  const baseId = useId()

  const toggle = (i: number) => setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
  const completed = checked.filter(Boolean).length
  const ratio = normalized.length ? completed / normalized.length : 0

  return (
    <section className="panel" aria-label={title}>
      <div className="panel-head">
        <p className="panel-title m-0"><PIcon name="listChecks" className="h-4 w-4 text-primary-light" /> {title}</p>
        <span className="mono-label ml-auto" aria-live="polite">{completed}/{normalized.length} done</span>
      </div>

      <div className="h-0.5 bg-[rgb(var(--ink-rgb)/0.08)]" aria-hidden="true">
        <motion.div
          className="h-full origin-left bg-primary"
          animate={{ scaleX: ratio }}
          initial={false}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
          style={{ width: '100%' }}
        />
      </div>

      <ul className="m-0 list-none space-y-1 p-3">
        {normalized.map((item, i) => {
          const id = `${baseId}-${i}`
          return (
            <li key={id} className="m-0">
              <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[rgb(var(--ink-rgb)/0.04)]">
                <input
                  id={id}
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--color-accent-strong)]"
                />
                <span className={`text-sm transition-colors ${checked[i] ? 'text-muted line-through' : 'text-ink/90'}`}>
                  {item.text}
                  {item.required && <span className="ml-1.5 font-mono text-[0.7rem] text-fail">required</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

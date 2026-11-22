import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'

/** The blog's boxes, with the exact syntax its articles use (blog/components/mdx). */
const SNIPPETS: { name: string; what: string; code: string }[] = [
  {
    name: 'Callout',
    what: 'A highlighted note. type: info, tip, warning, success or error.',
    code: '<Callout type="tip" title="Short heading">\n  The note, in plain sentences.\n</Callout>',
  },
  {
    name: 'KeyTakeaways',
    what: 'A summary box, usually near the top.',
    code: '<KeyTakeaways>\n- First point.\n- Second point.\n</KeyTakeaways>',
  },
  {
    name: 'QAChecklist',
    what: 'A ticked checklist.',
    code: '<QAChecklist\n  title="Check before you submit"\n  items={[\n    { text: "First check" },\n    { text: "Second check" },\n  ]}\n/>',
  },
  {
    name: 'BugReport',
    what: 'A bug report card.',
    code: '<BugReport\n  id="QA-1001"\n  title="Login: form submits with an empty email field"\n  severity="high"\n  priority="P2"\n  status="open"\n  environment="Chrome | Windows 11 | Staging"\n  reportedBy="Dipak Bist"\n  assignedTo="Web team"\n/>',
  },
  {
    name: 'TestCase',
    what: 'A test case card.',
    code: '<TestCase\n  id="TC-001"\n  title="What the test checks"\n  objective="The behaviour being verified"\n  preconditions="What must be true first"\n  type="API"\n  priority="high"\n  author="Dipak Bist"\n/>',
  },
]

interface Props {
  value: string
  onChange: (value: string) => void
}

/**
 * Markdown (MDX) body. Plain Markdown works as usual: ## headings, **bold**,
 * lists, links, ``` code blocks. The blog's boxes are written as tags. If a
 * post has a mistake in a box, the blog still shows it, as plain Markdown.
 */
export default function MarkdownEditor({ value, onChange }: Props) {
  const [helpOpen, setHelpOpen] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)

  const insert = (code: string) => {
    const el = area.current
    if (!el) return onChange(value + (value.endsWith('\n') || !value ? '' : '\n\n') + code + '\n')
    const start = el.selectionStart
    const before = value.slice(0, start)
    const after = value.slice(el.selectionEnd)
    const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
    onChange(`${before}${pad}${code}\n${after}`)
    requestAnimationFrame(() => {
      el.focus()
      const pos = before.length + pad.length + code.length + 1
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="glass-card overflow-hidden">
      <textarea
        ref={area}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        aria-label="Post body in Markdown"
        placeholder={'## First section\n\nWrite in Markdown. Use the boxes below for callouts, checklists and cards.'}
        className="block w-full min-h-[520px] resize-y bg-[#0d1117] p-5 font-mono text-[13px] leading-6 text-slate-200 placeholder:text-slate-600 outline-none"
      />
      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setHelpOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:text-white"
          aria-expanded={helpOpen}
        >
          <span className="flex items-center gap-2"><BookOpen size={15} /> Markdown and the blog&apos;s boxes</span>
          {helpOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {helpOpen && (
          <div className="px-4 pb-4 space-y-3 text-xs text-slate-400">
            <p>
              Headings <code>## Section</code>, bold <code>**text**</code>, links <code>[text](https://…)</code>,
              lists <code>- item</code>, code blocks between <code>```python</code> and <code>```</code>.
              Write <code>{'\\{'}</code> and <code>{'\\<'}</code> for a literal curly brace or angle bracket.
            </p>
            <ul className="space-y-2">
              {SNIPPETS.map((s) => (
                <li key={s.name} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-200">{s.name}</p>
                    <p>{s.what}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => insert(s.code)}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-slate-200 hover:border-primary"
                  >
                    Insert
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

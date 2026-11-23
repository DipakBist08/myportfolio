import { useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ARTICLE_TYPES, DIFFICULTIES, type BlogMeta, type FaqItem } from '@/types'

/** The blog's topic clusters (blog/lib/blog/clusters.json). */
const CLUSTERS: [string, string][] = [
  ['qa-fundamentals', 'QA fundamentals'],
  ['api-testing', 'API testing'],
  ['playwright-python', 'Playwright with Python'],
  ['multi-tenant-saas', 'Testing multi-tenant SaaS'],
  ['bdd-behave', 'BDD with Behave'],
  ['jmeter-performance', 'Performance testing with JMeter'],
  ['ai-lab', 'AI Lab'],
  ['qa-careers', 'QA careers'],
]

const selectClass =
  'w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-ring outline-none'

const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean)
const commas = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean)
const today = () => new Date().toISOString().slice(0, 10)

interface Props {
  value: BlogMeta
  onChange: (value: BlogMeta) => void
}

/** What the blog shows and tells search engines about the article. */
export default function BlogDetails({ value, onChange }: Props) {
  const [open, setOpen] = useState(true)
  const set = (patch: Partial<BlogMeta>) => onChange({ ...value, ...patch })
  const faq = value.faq ?? []
  const setFaq = (items: FaqItem[]) => set({ faq: items })

  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-300 hover:text-white"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2"><ListChecks size={15} /> Article details for the blog</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="p-4 pt-0 space-y-4 border-t border-border">
          <div className="grid gap-3 sm:grid-cols-2 pt-4">
            <div>
              <Label htmlFor="articleType">Article type</Label>
              <select id="articleType" className={selectClass} value={value.articleType ?? ''}
                onChange={(e) => set({ articleType: (e.target.value || null) as BlogMeta['articleType'] })}>
                <option value="">Not set</option>
                {ARTICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-xs text-slate-500 mt-1">Shown next to the date, so readers know what kind of article it is.</p>
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <select id="difficulty" className={selectClass} value={value.difficulty ?? ''}
                onChange={(e) => set({ difficulty: (e.target.value || null) as BlogMeta['difficulty'] })}>
                <option value="">Not set</option>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="primaryQuery">Main search phrase</Label>
            <Input id="primaryQuery" value={value.primaryQuery ?? ''} placeholder="e.g. bug report example"
              onChange={(e) => set({ primaryQuery: e.target.value })} />
            <p className="text-xs text-slate-500 mt-1">What people type into Google to find this article.</p>
          </div>
          <div>
            <Label htmlFor="secondaryQueries">Other search phrases (one per line)</Label>
            <Textarea id="secondaryQueries" rows={3} value={(value.secondaryQueries ?? []).join('\n')}
              onChange={(e) => set({ secondaryQueries: lines(e.target.value) })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cluster">Topic cluster</Label>
              <select id="cluster" className={selectClass} value={value.cluster ?? ''}
                onChange={(e) => set({ cluster: e.target.value })}>
                <option value="">None</option>
                {CLUSTERS.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="dateModified">Last updated (shown on the post)</Label>
              <div className="flex gap-2">
                <Input id="dateModified" type="date" value={value.dateModified ?? ''}
                  onChange={(e) => set({ dateModified: e.target.value || null })} />
                <button type="button" onClick={() => set({ dateModified: today() })}
                  className="shrink-0 rounded-md border border-border px-2 text-xs text-slate-300 hover:border-primary">Today</button>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" className="accent-primary" checked={!!value.isPillar}
              onChange={(e) => set({ isPillar: e.target.checked })} />
            Pillar article (the main guide of its topic cluster)
          </label>

          <div>
            <Label htmlFor="testedWith">Tested with</Label>
            <Input id="testedWith" value={value.testedWith ?? ''} placeholder="e.g. Playwright for Python 1.49, Python 3.12"
              onChange={(e) => set({ testedWith: e.target.value })} />
            <p className="text-xs text-slate-500 mt-1">For tutorials: the tool versions the code was run against.</p>
          </div>
          <div>
            <Label htmlFor="tools">Tools (comma separated)</Label>
            <Input id="tools" value={(value.tools ?? []).join(', ')} placeholder="Playwright, pytest, Python"
              onChange={(e) => set({ tools: commas(e.target.value) })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Frequently asked questions</Label>
              <button type="button" onClick={() => setFaq([...faq, { q: '', a: '' }])}
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"><Plus size={13} /> Add question</button>
            </div>
            <p className="text-xs text-slate-500">Shown at the end of the post and given to Google as FAQ data.</p>
            {faq.map((item, i) => (
              <div key={i} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input value={item.q} placeholder="Question" aria-label={`Question ${i + 1}`}
                    onChange={(e) => setFaq(faq.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)))} />
                  <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => setFaq(faq.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-md border border-border px-2 text-slate-400 hover:text-destructive"><Trash2 size={14} /></button>
                </div>
                <Textarea rows={2} value={item.a} placeholder="Answer" aria-label={`Answer ${i + 1}`}
                  onChange={(e) => setFaq(faq.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)))} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

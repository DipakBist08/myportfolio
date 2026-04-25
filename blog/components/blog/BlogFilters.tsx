'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

interface BlogFiltersProps {
  categories: string[]
  tags: string[]
}

export default function BlogFilters({ categories, tags }: BlogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeCategory = searchParams.get('category') ?? ''
  const activeTag = searchParams.get('tag') ?? ''

  const setFilter = useCallback(
    (key: 'category' | 'tag', value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) { params.set(key, value) } else { params.delete(key) }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('category')
    params.delete('tag')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const hasFilters = activeCategory || activeTag

  return (
    <div className="space-y-5">
      {hasFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-light light:hover:text-primary transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
          Clear filters
        </button>
      )}

      {/* Categories */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 light:text-slate-400">Category</p>
        <div className="flex flex-col gap-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter('category', activeCategory === cat ? '' : cat)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-left transition-all ${
                activeCategory === cat
                  ? 'bg-primary/15 text-primary-light border border-primary/30 light:bg-indigo-50 light:text-indigo-700 light:border-indigo-200'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900'
              }`}
            >
              {activeCategory === cat && (
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className={activeCategory === cat ? '' : 'pl-5'}>{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 light:text-slate-400">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter('tag', activeTag === tag ? '' : tag)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                activeTag === tag
                  ? 'border-primary bg-primary/15 text-primary-light light:bg-indigo-100 light:border-indigo-300 light:text-indigo-700'
                  : 'border-slate-700/60 text-slate-400 hover:border-primary/40 hover:text-primary-light light:border-slate-200 light:text-slate-600 light:hover:border-indigo-300 light:hover:text-indigo-700 light:hover:bg-indigo-50'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

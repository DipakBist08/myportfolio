'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'

export default function BlogSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  const submit = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (q) { params.set('q', q) } else { params.delete('q') }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit(value)}
        placeholder="Search articles..."
        className="w-full rounded-xl border border-slate-700/60 bg-slate-800/60 py-2.5 pl-10 pr-10 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20 light:border-slate-200 light:bg-white light:text-slate-800 light:placeholder-slate-400 light:focus:border-primary/40 light:focus:ring-primary/10"
      />
      {value && (
        <button
          onClick={() => { setValue(''); submit('') }}
          className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300 light:hover:text-slate-700 transition-colors"
          aria-label="Clear search"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

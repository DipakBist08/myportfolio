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
        <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        className="w-full rounded-xl border border-line bg-surface-card py-2.5 pl-10 pr-10 text-sm text-ink placeholder:text-subtle outline-none transition focus:border-primary  light:border-line light:bg-white light:text-muted light:placeholder:text-subtle light:focus:border-primary light:focus:ring-primary/10"
      />
      {value && (
        <button
          onClick={() => { setValue(''); submit('') }}
          className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink/90 light:hover:text-muted transition-colors"
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

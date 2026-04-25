import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <div className="mb-4 font-mono text-6xl font-bold gradient-text">404</div>
      <h1 className="mb-2 font-heading text-2xl font-bold text-slate-100 light:text-slate-900">
        Post Not Found
      </h1>
      <p className="mb-6 text-slate-400 light:text-slate-600">
        This article may have been moved or deleted.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Blog
      </Link>
    </div>
  )
}

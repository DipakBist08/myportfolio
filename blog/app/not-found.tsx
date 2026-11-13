import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-start justify-center gap-4 py-16">
      <p className="mono-label">expect(article).toExist()</p>
      <h1 className="text-[clamp(2rem,1.5rem+2vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
        404: this page did not pass
      </h1>
      <p className="max-w-[52ch] text-muted">
        The article you followed does not exist here. It may have moved, or the address has a typo.
      </p>
      <Link href="/" className="btn btn-primary mt-2">Back to all articles</Link>
    </div>
  )
}

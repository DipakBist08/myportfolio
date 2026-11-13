import Image from 'next/image'
import ExternalLink from '@/components/layout/ExternalLink'
import { AUTHOR } from '@/lib/blog/site'

/** Same author, same wording, same links at the end of every post. */
export default function AuthorBox() {
  const [linkedin, github] = AUTHOR.sameAs

  return (
    <section className="mt-10 flex gap-4 rounded-xl border border-line p-5 sm:gap-5 sm:p-6" aria-label="About the author">
      <Image
        src="/dipak-bist.png"
        alt="Dipak Bist"
        width={64}
        height={64}
        sizes="64px"
        loading="lazy"
        className="h-16 w-16 shrink-0 rounded-full border border-line object-cover"
      />
      <div className="min-w-0">
        <p className="mono-label uppercase tracking-[0.06em]">Written by</p>
        <p className="mt-1 text-lg font-semibold text-ink">
          <ExternalLink href={AUTHOR.url} rel="author" className="text-ink no-underline hover:text-primary-light">
            {AUTHOR.name}
          </ExternalLink>
          <span className="font-normal text-muted"> &mdash; {AUTHOR.jobTitle}, Kathmandu</span>
        </p>
        <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted">
          Writes about test automation with Playwright and Python, API testing, and manual QA. Every code example on
          this blog is run before it is published.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <ExternalLink href={AUTHOR.url} className="text-primary-light">Portfolio</ExternalLink>
          <ExternalLink href={linkedin} rel="me" className="text-primary-light">LinkedIn</ExternalLink>
          <ExternalLink href={github} rel="me" className="text-primary-light">GitHub</ExternalLink>
        </p>
      </div>
    </section>
  )
}

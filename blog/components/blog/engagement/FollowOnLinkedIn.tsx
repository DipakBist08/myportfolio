import Image from 'next/image'
import ExternalLink from '@/components/layout/ExternalLink'
import { BRAND_PATHS } from '@/components/blog/ShareLinks'
import { AUTHOR, PROFILES } from '@/lib/blog/site'

export const LINKEDIN_URL = PROFILES.find((p) => p.id === 'linkedin')!.url

/** "Follow on LinkedIn": opens the author's LinkedIn profile in a new tab, so
 *  the reader keeps their place in the article. rel="me" and no other label,
 *  like every profile link on the blog (the SEO validator checks this).
 *  Below 480px the label may wrap, so large text on a small phone never
 *  pushes it off the screen. */
export function FollowOnLinkedIn({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const sm = size === 'sm'
  return (
    <ExternalLink
      href={LINKEDIN_URL}
      rel="me"
      className={`inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap text-center rounded-full max-[479px]:whitespace-normal bg-[#0A66C2] font-semibold text-white no-underline transition-[background-color,box-shadow] hover:bg-[#004182] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A66C2] ${
        sm ? 'min-h-8 px-3 text-xs' : 'min-h-10 px-4 text-sm'
      } ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${sm ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} fill="currentColor">
        <path d={BRAND_PATHS.linkedin} />
      </svg>
      Follow on LinkedIn
    </ExternalLink>
  )
}

/** The article's side column on wide screens: who wrote it and a one-click
 *  LinkedIn follow, so readers don't have to leave the post to find it. */
export function AuthorAside() {
  return (
    <section aria-label="About the author" className="rounded-xl border border-line p-5">
      <Image
        src="/dipak-bist.png"
        alt=""
        width={56}
        height={56}
        sizes="56px"
        className="h-14 w-14 rounded-full border border-line object-cover"
      />
      <p className="mt-3 font-semibold leading-snug text-ink">
        <ExternalLink href={AUTHOR.url} rel="author" className="text-ink no-underline hover:text-primary-light">
          {AUTHOR.name}
        </ExternalLink>
      </p>
      <p className="mono-label mt-0.5">{AUTHOR.jobTitle}, Kathmandu</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Writes about test automation with Playwright and Python, API testing, and manual QA.
      </p>
      <FollowOnLinkedIn className="mt-4 w-full" />
    </section>
  )
}

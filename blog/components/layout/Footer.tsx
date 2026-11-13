import Link from 'next/link'
import NewsletterForm from '@/components/blog/NewsletterForm'
import ExternalLink from './ExternalLink'

const PORTFOLIO_URL = 'https://dipakbist.com.np'
const GITHUB_URL = 'https://github.com/DipakBist08'
const LINKEDIN_URL = 'https://www.linkedin.com/in/dipakbist'

interface FooterProps {
  /** Every category hub with published posts (built in app/layout.tsx), so each
   *  post is at most two clicks from any page: footer, hub, post. */
  categoryLinks: { href: string; label: string }[]
}

export default function Footer({ categoryLinks }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-line bg-[var(--color-bg-raised)]">
      {/* Newsletter band */}
      <div className="border-b border-line">
        <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <h2 className="text-xl font-semibold text-ink">Get articles in your inbox</h2>
            <p className="mt-1 text-sm text-muted">New QA articles, tips and tutorials, delivered when they drop.</p>
          </div>
          <div className="w-full sm:w-[26rem]">
            <NewsletterForm compact />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="container-page py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center font-mono text-[1.05rem] font-semibold text-ink no-underline">
              <span className="text-primary-light">&lt;</span>Dipak.Blog<span className="text-primary-light">/&gt;</span>
            </Link>
            <p className="mt-1 text-sm text-muted">Notes on Software Quality Assurance</p>
          </div>

          <nav className="flex flex-wrap gap-x-5 text-sm" aria-label="Footer">
            <FooterLink href="/">Articles</FooterLink>
            {categoryLinks.map((l) => (
              <FooterLink key={l.href} href={l.href}>{l.label}</FooterLink>
            ))}
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
            <FooterLink href="/privacy-policy">Privacy Policy</FooterLink>
            <FooterLink href="/disclaimer">Disclaimer</FooterLink>
            <ExternalLink href={PORTFOLIO_URL} className="inline-flex min-h-11 items-center text-muted no-underline transition-colors hover:text-ink">Portfolio</ExternalLink>
          </nav>

          <ul className="flex items-center gap-1" aria-label="Elsewhere">
            <li>
              <SocialLink href={GITHUB_URL} label="GitHub">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </SocialLink>
            </li>
            <li>
              <SocialLink href={LINKEDIN_URL} label="LinkedIn">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </SocialLink>
            </li>
          </ul>
        </div>

        <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
          &copy; {year} Dipak Bist &middot; Built with Next.js, MDX &amp; Tailwind CSS
        </p>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-muted no-underline transition-colors hover:text-ink">
      {children}
    </Link>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="me noopener noreferrer"
      aria-label={`Dipak Bist on ${label}`}
      className="inline-grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--ink-rgb)/0.06)] hover:text-ink"
    >
      <svg className="h-[1.1rem] w-[1.1rem]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{children}</svg>
    </a>
  )
}

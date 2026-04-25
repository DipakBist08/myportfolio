import Link from 'next/link'

const PORTFOLIO_URL = 'https://dipakbist.com'
const GITHUB_URL = 'https://github.com/DipakBist08'
const LINKEDIN_URL = 'https://www.linkedin.com/in/dipakbist08/'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-800/60 bg-surface-darker/80 light:bg-slate-50 light:border-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">

          {/* Brand */}
          <div className="text-center sm:text-left">
            <Link href="/" className="font-heading text-base font-bold">
              <span className="text-slate-500">&lt;</span>
              <span className="gradient-text">QA</span>
              <span className="text-primary">.</span>
              <span className="gradient-text">Blog</span>
              <span className="text-slate-500">/&gt;</span>
            </Link>
            <p className="mt-1 text-xs text-slate-500 light:text-slate-400">
              Notes on Software Quality Assurance
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-4 text-sm">
            <FooterLink href="/">All Posts</FooterLink>
            <FooterLink href="/blog/category/automation-testing">Automation</FooterLink>
            <FooterLink href="/blog/category/api-testing">API Testing</FooterLink>
            <FooterLink href="/rss.xml">RSS</FooterLink>
          </nav>

          {/* Socials */}
          <div className="flex items-center gap-2">
            <SocialLink href={GITHUB_URL} label="GitHub">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </SocialLink>
            <SocialLink href={LINKEDIN_URL} label="LinkedIn">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </SocialLink>
            <a
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Portfolio"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 text-slate-500 hover:border-primary/50 hover:text-primary-light light:border-slate-200 light:text-slate-500 light:hover:border-primary/40 light:hover:text-primary transition-all text-xs font-mono font-bold"
            >
              &lt;/&gt;
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800/40 pt-5 text-center text-xs text-slate-600 light:border-slate-200 light:text-slate-400">
          &copy; {year} Dipak Bist · Built with Next.js, MDX & Tailwind CSS
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-slate-500 hover:text-primary-light light:text-slate-500 light:hover:text-primary transition-colors">
      {children}
    </Link>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 text-slate-500 hover:border-primary/50 hover:text-primary-light light:border-slate-200 light:text-slate-500 light:hover:border-primary/40 light:hover:text-primary transition-all"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">{children}</svg>
    </a>
  )
}

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import SitePage from '@/components/layout/SitePage'
import ExternalLink from '@/components/layout/ExternalLink'
import { getAllPostsMeta } from '@/lib/blog/posts'
import { sortPostsByDate } from '@/lib/blog/utils'
import { AUTHOR, AUTHOR_LD, BASE_URL, PROFILES } from '@/lib/blog/site'
import { pageMetadata } from '@/lib/blog/metadata'
import { SITE_PAGES } from '@/lib/blog/pages'

const DESCRIPTION =
  'Dipak Bist is a Software QA Engineer in Kathmandu, Nepal, with 4+ years in QA. His experience, projects and profiles, and how this blog tests every article.'

export const metadata: Metadata = pageMetadata({ title: 'About the Author', description: DESCRIPTION, path: SITE_PAGES.about.path })

const aboutLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${BASE_URL}/about`,
  url: `${BASE_URL}/about`,
  name: 'About Dipak Bist and this blog',
  mainEntity: AUTHOR_LD,
}

/* The author profile (SEO brief, Part 12). Every fact here is on the portfolio, which stays the
   full source: roles and dates from its Professional Experience, project names from its Projects. */
const ROLES = [
  { title: 'Associate QA Engineer', org: 'Sterling Wells (product: FigsFlow)', when: 'Feb 2024 to present' },
  { title: 'QA Analyst', org: 'E-Signature Pvt. Ltd.', when: 'Aug 2023 to Feb 2024' },
  { title: 'Quality Assurance Intern', org: 'Moru Digital Wallet', when: 'Mar 2023 to Aug 2023' },
]

export const revalidate = 60

export default async function AboutPage() {
  const posts = sortPostsByDate((await getAllPostsMeta()).filter((p) => !p.draft))

  return (
    <SitePage title="About Dipak Bist and this blog" intro="Practical notes on software testing, written by a working QA engineer.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutLd) }} />

      <h2>Who writes it</h2>
      <div className="not-prose my-6 flex flex-wrap items-center gap-4">
        <Image
          src="/dipak-bist.png"
          alt="Dipak Bist, Software QA Engineer"
          width={96}
          height={96}
          sizes="96px"
          className="h-24 w-24 shrink-0 rounded-full border border-line object-cover"
        />
        <p className="min-w-[10rem] flex-1 text-muted">
          <span className="block text-lg font-semibold text-ink">{AUTHOR.name}</span>
          {AUTHOR.jobTitle} &middot; {AUTHOR.location}
        </p>
      </div>
      <p>
        I am <ExternalLink href={AUTHOR.url}>Dipak Bist</ExternalLink>, a {AUTHOR.jobTitle} based in {AUTHOR.location}, with
        4+ years of experience in software quality assurance, manual testing, functional testing, test automation, API
        testing, SaaS platform testing and AI-assisted Quality Engineering. My full work history, skills, projects and
        resume are on my portfolio at <ExternalLink href={AUTHOR.url}>dipakbist.com.np</ExternalLink>.
      </p>

      <h3>Experience</h3>
      <ul>
        {ROLES.map((r) => (
          <li key={r.title}>
            <strong>{r.title}</strong>, {r.org}, {r.when}
          </li>
        ))}
      </ul>
      <p>
        What each role involved is under{' '}
        <ExternalLink href={`${AUTHOR.url}#experience`}>Professional Experience</ExternalLink> on my portfolio.
      </p>

      <h3>Skills and tools</h3>
      <p>
        Playwright with Python and Pytest, API testing with Postman and Python Requests, Selenium with Behave, Jira and
        Azure DevOps, JMeter, SQL and Git, and Claude Code for AI-assisted QA. How deep each one goes is under{' '}
        <ExternalLink href={`${AUTHOR.url}#skills`}>Skills &amp; Expertise</ExternalLink>.
      </p>

      <h3>Projects</h3>
      <p>
        The worked projects FigsFlow, AakashTel and Moru-Digital Wallet, plus a REST API Testing Framework, a BDD Test
        Framework and the Dreamer&apos;s Youth Club website, each described under{' '}
        <ExternalLink href={`${AUTHOR.url}#projects`}>Projects</ExternalLink> on my portfolio.
      </p>

      <h3>Articles</h3>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>

      <h3>Profiles</h3>
      <ul>
        {PROFILES.map((profile) => (
          <li key={profile.id}>
            <ExternalLink href={profile.url} rel="me">{profile.label}</ExternalLink>
          </li>
        ))}
      </ul>

      <h2>What the blog covers</h2>
      <ul>
        <li>Test automation with Playwright and Python: page objects, pytest fixtures, saved login sessions, reports.</li>
        <li>API testing with Postman and Python, including schema validation and authentication flows.</li>
        <li>Manual QA: bug reports, exploratory testing, risk-based test design and release checks.</li>
        <li>Testing multi-tenant SaaS products: roles, permissions and data isolation between tenants.</li>
        <li>BDD with Behave and performance testing with JMeter.</li>
        <li>
          AI in testing, in the <Link href="/blog/category/ai-lab">AI Lab</Link>: using AI tools in QA work with human
          review, agentic AI testing with AI agents that plan, write and run tests, and how to test AI agents themselves.
        </li>
        <li>Starting and growing a QA career, especially in Nepal and South Asia.</li>
      </ul>

      <h2>Who it is for</h2>
      <ul>
        <li>Junior and mid-level QA engineers.</li>
        <li>Manual testers moving into automation.</li>
        <li>Developers who write tests.</li>
        <li>People starting a career in QA.</li>
        <li>Anyone passionate about software quality who wants to explore how good testing is done.</li>
        <li>
          Testers and developers following where testing is heading next, especially agentic AI testing: AI agents
          that explore an application, write and run tests and report what they find, and the new ways of testing that
          AI agents themselves need.
        </li>
      </ul>

      <h2>How articles are written</h2>
      <ul>
        <li>Code examples are run before they are published, and each article lists the tool versions it was tested with.</li>
        <li>Technical claims are checked against the official documentation, which is linked in the article.</li>
        <li>Examples are generic. Nothing here describes an employer, its product or its clients.</li>
        <li>Articles are reviewed and updated when the tools change. The date of the last update is shown at the top.</li>
      </ul>

      <h2>Get in touch</h2>
      <p>
        Corrections and questions are welcome. Use the <Link href="/contact">contact page</Link>, or write to me on any of
        the profiles above.
      </p>
    </SitePage>
  )
}

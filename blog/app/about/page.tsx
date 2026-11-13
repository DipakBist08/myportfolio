import type { Metadata } from 'next'
import Link from 'next/link'
import SitePage from '@/components/layout/SitePage'
import ExternalLink from '@/components/layout/ExternalLink'
import { AUTHOR, AUTHOR_LD, BASE_URL } from '@/lib/blog/site'

const DESCRIPTION =
  'About the QA blog of Dipak Bist, a Software QA Engineer in Kathmandu, Nepal: what the blog covers, who it is for, and how every article is tested.'

export const metadata: Metadata = {
  title: 'About',
  description: DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/about` },
}

const aboutLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${BASE_URL}/about`,
  url: `${BASE_URL}/about`,
  name: 'About the Dipak Bist QA Blog',
  mainEntity: AUTHOR_LD,
}

export default function AboutPage() {
  const [linkedin, github] = AUTHOR.sameAs

  return (
    <SitePage title="About this blog" intro="Practical notes on software testing, written by a working QA engineer.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutLd) }} />

      <h2>Who writes it</h2>
      <p>
        I am <ExternalLink href={AUTHOR.url}>Dipak Bist</ExternalLink>, a {AUTHOR.jobTitle} based in {AUTHOR.location}.
        My work history, projects and resume are on my portfolio at{' '}
        <ExternalLink href={AUTHOR.url}>dipakbist.com.np</ExternalLink>.
      </p>

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
        Corrections and questions are welcome. Use the <Link href="/contact">contact page</Link>, or find me on{' '}
        <ExternalLink href={linkedin} rel="me">LinkedIn</ExternalLink> and{' '}
        <ExternalLink href={github} rel="me">GitHub</ExternalLink>.
      </p>
    </SitePage>
  )
}

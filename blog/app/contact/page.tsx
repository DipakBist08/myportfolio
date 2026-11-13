import type { Metadata } from 'next'
import SitePage from '@/components/layout/SitePage'
import ExternalLink from '@/components/layout/ExternalLink'
import { AUTHOR, BASE_URL } from '@/lib/blog/site'

/* The same public address the portfolio's contact section uses. */
const CONTACT_EMAIL = 'dipakbeest@gmail.com'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Dipak Bist, Software QA Engineer: report a mistake in an article, ask a testing question, or get in touch about QA work, by email or LinkedIn.',
  alternates: { canonical: `${BASE_URL}/contact` },
}

export default function ContactPage() {
  const [linkedin, github] = AUTHOR.sameAs

  return (
    <SitePage title="Contact" intro="Found a mistake, have a question about an article, or want to talk about QA work?">
      <h2>Email</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('QA blog')}`}>{CONTACT_EMAIL}</a>
      </p>

      <h2>Contact form</h2>
      <p>
        There is a contact form on my portfolio:{' '}
        <ExternalLink href={`${AUTHOR.url}#contact`}>dipakbist.com.np/#contact</ExternalLink>.
      </p>

      <h2>Elsewhere</h2>
      <ul>
        <li><ExternalLink href={linkedin} rel="me">LinkedIn</ExternalLink></li>
        <li><ExternalLink href={github} rel="me">GitHub</ExternalLink></li>
      </ul>

      <h2>Corrections</h2>
      <p>
        If a code example does not run or a claim is wrong, please tell me which article and what you saw. Include the
        tool versions you used. I fix confirmed mistakes and update the article&apos;s date.
      </p>
    </SitePage>
  )
}

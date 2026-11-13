import type { Metadata } from 'next'
import Link from 'next/link'
import SitePage, { ReviewNotice } from '@/components/layout/SitePage'
import { BASE_URL } from '@/lib/blog/site'

/* DRAFT for the site owner's review. Set REVIEWED to true once checked. */
const REVIEWED = false
const LAST_UPDATED = '2026-11-12'

export const metadata: Metadata = {
  title: 'Disclaimer',
  description:
    'Disclaimer for the Dipak Bist QA Blog: articles are personal views for general information, code examples come without warranty, and how ads are handled.',
  alternates: { canonical: `${BASE_URL}/disclaimer` },
}

export default function DisclaimerPage() {
  return (
    <SitePage title="Disclaimer" updated={LAST_UPDATED}>
      {!REVIEWED && (
        <ReviewNotice>This page is a draft and has not yet been checked by the site owner.</ReviewNotice>
      )}

      <h2>Personal views</h2>
      <p>
        Everything on this blog is my own view. It does not represent any current or former employer or client, and no
        article describes their products, systems or data.
      </p>

      <h2>General information only</h2>
      <p>
        Articles are written for general information and learning. They are not professional advice for your specific
        project. Test any approach in your own environment before you rely on it.
      </p>

      <h2>Code examples</h2>
      <p>
        Code examples are run before publishing, against the tool versions listed in each article. Tools change, so an
        example may stop working with newer versions. Code is provided as is, without warranty, and you use it at your
        own risk.
      </p>

      <h2>External links</h2>
      <p>
        Links to other websites are provided for reference. I do not control those sites and am not responsible for
        their content.
      </p>

      <h2>Advertising</h2>
      <p>
        This blog may show ads. Ads are labeled as advertisements and are chosen by the ad network, not by me. An ad
        appearing next to an article is not a recommendation. See the <Link href="/privacy-policy">privacy policy</Link>{' '}
        for how advertising cookies work.
      </p>

      <h2>Corrections</h2>
      <p>
        If you find a mistake, please tell me through the <Link href="/contact">contact page</Link>.
      </p>
    </SitePage>
  )
}

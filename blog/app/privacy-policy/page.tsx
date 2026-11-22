import type { Metadata } from 'next'
import Link from 'next/link'
import SitePage, { ReviewNotice } from '@/components/layout/SitePage'
import ExternalLink from '@/components/layout/ExternalLink'
import { pageMetadata } from '@/lib/blog/metadata'
import { SITE_PAGES } from '@/lib/blog/pages'
import { GA_MEASUREMENT_ID } from '@/lib/analytics'

/* DRAFT. This text was drafted from what the code does; it is not legal advice.
   The site owner must check every statement (the items marked CHECK below in
   particular), then set REVIEWED to true to remove the notice from the page. */
const REVIEWED = false
const LAST_UPDATED = SITE_PAGES.privacyPolicy.updated
/* Google Analytics is described only once a measurement ID is set (lib/analytics.ts). */
const ANALYTICS = Boolean(GA_MEASUREMENT_ID)

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'Privacy policy for the Dipak Bist QA Blog: data from Google sign-in, responses, claps and the newsletter, how cookies are used, and advertising by Google.',
  path: SITE_PAGES.privacyPolicy.path,
})

export default function PrivacyPolicyPage() {
  return (
    <SitePage title="Privacy Policy" updated={LAST_UPDATED}>
      {!REVIEWED && (
        <ReviewNotice>
          This policy is a draft and has not yet been checked by the site owner. It should be reviewed before it is
          relied on.
        </ReviewNotice>
      )}

      <p>
        This policy explains what information this blog (blog.dipakbist.com.np) collects, why, and what choices you
        have. The blog is run by Dipak Bist. Questions go to the address on the <Link href="/contact">contact page</Link>.
      </p>

      <h2>Information you give</h2>
      <ul>
        <li>
          <strong>Newsletter.</strong> If you subscribe, your email address is stored so new articles can be sent to
          you. Every email has an unsubscribe link. {/* CHECK: confirm the unsubscribe link and name the email delivery provider. */}
        </li>
        <li>
          <strong>Responses and claps.</strong> To post a response (a comment) or a reply, or to clap for an article,
          you sign in with Google (see <a href="#google-sign-in">Signing in with Google</a>). Your response is stored with
          the name, email address and profile picture from your Google account. Your name, picture and response are
          shown publicly; your email address is not. A clap is stored per article for your account (one each, which you
          can take back); only the total is shown. Until Google sign-in is switched on, a response is posted with a name and email address
          instead (the name is shown, the email is not), and those responses keep the name and email given then.
        </li>
        <li>
          <strong>Email.</strong> If you write to me, I keep the message for as long as needed to answer it.
        </li>
      </ul>
      <p>
        Newsletter, sign-in, response and clap data is sent to and stored by this site&apos;s own service at
        api.dipakbist.com.np.
        {/* CHECK: state where that service is hosted and how long data is kept. */}
      </p>

      <h2>Information collected automatically</h2>
      <ul>
        <li>
          <strong>Server logs.</strong> The blog is hosted by Vercel. Like any web host, it processes technical data
          such as your IP address, browser type and the pages requested, to deliver the site and keep it secure.
        </li>
        <li>
          <strong>Theme preference.</strong> Your choice of light or dark theme is saved in your browser&apos;s local
          storage. It stays on your device and is not sent to me.
        </li>
      </ul>

      <h2>Cookies and analytics</h2>
      <p>
        {ANALYTICS ? (
          <>
            This blog sets no cookies of its own except one that remembers your analytics choice and, if you sign in,
            one that keeps you signed in (see below). It uses Google Analytics only if you allow it (see{' '}
            <a href="#analytics">Google Analytics</a> below).
          </>
        ) : (
          <>This blog sets no cookies of its own unless you sign in (see below), and uses no third-party analytics service.</>
        )}{' '}
        To show how many people
        read each post and to count visits, the blog&apos;s own server records each page you open: the page address,
        its title, the website that linked you here (the site name only), the time, and an anonymous visitor code.
        That code is made from your internet address and browser type with a secret key, so the same visitor is
        counted once, but your address itself is never stored and the code cannot be turned back into it. Visits are
        not recorded if your browser sends a Do Not Track or Global Privacy Control signal. The same anonymous code
        lets you like or dislike a comment once. {/* CHECK: state how long page-view records are kept. */} If this
        changes, this page will be updated first.
      </p>

      {ANALYTICS && (
        <>
          <h2 id="analytics">Google Analytics (only if you allow it)</h2>
          <p>
            This blog and the portfolio at dipakbist.com.np can use Google Analytics 4 to see which pages are read and
            how visitors find them. It runs only if you choose <strong>Allow</strong> in the banner. Until then, nothing
            is loaded from Google.
          </p>
          <ul>
            <li>
              <strong>What it collects.</strong> The pages you view, the page that linked you here, your device and
              browser type, and an approximate location (country or city) that Google works out from your internet
              address. Google Analytics 4 does not log or store the address itself. It sets the cookies _ga and
              _ga_&lt;ID&gt; to tell visits apart.
            </li>
            <li>
              <strong>Who processes it.</strong> Google, as explained at{' '}
              <ExternalLink href="https://policies.google.com/technologies/partner-sites">
                policies.google.com/technologies/partner-sites
              </ExternalLink>
              . Google signals and ad personalization are switched off, so this data is not used to show you ads.
            </li>
            <li>
              <strong>Your choice.</strong> It is remembered for 180 days in a cookie named dipak_analytics_consent,
              shared by the blog and the portfolio. Use <strong>Cookie settings</strong> at the bottom of any page to
              change it. Declining after allowing removes the Google Analytics cookies.
            </li>
            <li>
              If your browser sends a Global Privacy Control or Do Not Track signal, you are not asked and Google
              Analytics never runs.
            </li>
          </ul>
          {/* CHECK: state how long Google keeps the data (Google Analytics: Admin, Data retention; 2 months unless changed). */}
        </>
      )}

      <h2 id="google-sign-in">Signing in with Google</h2>
      <p>
        Signing in is needed only to clap for an article or to post a response or reply; reading never needs it. When you
        choose &ldquo;Sign in with Google&rdquo;, the blog loads Google&apos;s sign-in service from accounts.google.com
        (it is not loaded before you open the sign-in window), and Google shares your Google account ID, name, email
        address and profile picture with this blog. The blog never sees your Google password. Google&apos;s handling of
        your data is described in the{' '}
        <ExternalLink href="https://policies.google.com/privacy">Google Privacy Policy</ExternalLink>.
      </p>
      <p>
        After you sign in, this site&apos;s service at api.dipakbist.com.np sets one cookie, <code>reader_session</code>, so
        you stay signed in. It holds only a signed reference to your account, cannot be read by scripts on the page, is
        sent only to that service, and expires after 30 days or when you sign out. It is needed for clapping and
        responding to work and is not used for tracking or advertising. Profile pictures in the responses are loaded
        from Google&apos;s servers (lh3.googleusercontent.com). {/* CHECK: confirm the 30-day session and how long reader accounts are kept. */}
      </p>

      <h2>Advertising</h2>
      <p>
        This blog may show advertisements served by Google AdSense. When it does:
      </p>
      <ul>
        <li>
          Third-party vendors, including Google, use cookies to serve ads based on your earlier visits to this website
          or to other websites.
        </li>
        <li>
          Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visits
          to this site and other sites on the Internet.
        </li>
        <li>
          You can opt out of personalized advertising in Google&apos;s{' '}
          <ExternalLink href="https://adssettings.google.com/">Ads Settings</ExternalLink>. You can opt out of some other
          vendors&apos; use of cookies for personalized advertising at{' '}
          <ExternalLink href="https://www.aboutads.info/choices/">aboutads.info</ExternalLink>.
        </li>
        <li>
          Google explains how it uses information from sites that use its services at{' '}
          <ExternalLink href="https://policies.google.com/technologies/partner-sites">
            policies.google.com/technologies/partner-sites
          </ExternalLink>
          .
        </li>
      </ul>
      <p>
        Visitors in the European Economic Area, the United Kingdom and Switzerland are asked for consent before
        personalized ads or advertising cookies are used. {/* CHECK: true only once the AdSense consent message is set up. */}
      </p>

      <h2>How your information is used</h2>
      <ul>
        <li>To send the newsletter you asked for.</li>
        <li>To show and moderate responses, and to count claps.</li>
        <li>To answer messages.</li>
        <li>To keep the site working and secure.</li>
      </ul>
      <p>Your information is not sold.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Unsubscribe from the newsletter at any time using the link in any email.</li>
        <li>Sign out at any time with &ldquo;Sign out&rdquo; under the responses on any article.</li>
        <li>
          Ask for your response, your claps, your sign-in record, or the data stored with them, to be corrected or deleted
          through the <Link href="/contact">contact page</Link>. You can also remove the blog&apos;s access in your{' '}
          <ExternalLink href="https://myaccount.google.com/connections">Google account settings</ExternalLink>.
        </li>
        {ANALYTICS && <li>Allow or decline Google Analytics in the banner, and change it at any time with Cookie settings.</li>}
        <li>Block or delete cookies in your browser settings.</li>
      </ul>

      <h2>Links to other sites</h2>
      <p>Articles link to other websites, such as official documentation. Those sites have their own privacy policies.</p>

      <h2>Changes to this policy</h2>
      <p>If this policy changes, the new version is published here with a new date at the top.</p>
    </SitePage>
  )
}

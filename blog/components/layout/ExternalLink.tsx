import type { AnchorHTMLAttributes } from 'react'

/* The owner's own sites: the portfolio, the blog and their subdomains. */
const OWN_DOMAIN = 'dipakbist.com.np'

function isOwnSite(href?: string): boolean {
  try {
    const host = new URL(href ?? '').hostname
    return host === OWN_DOMAIN || host.endsWith(`.${OWN_DOMAIN}`)
  } catch {
    return false
  }
}

/** A link to another site. Every off-site link opens in a new tab, here and on
 *  the portfolio, with `noopener`; a `rel` passed in (such as "me" or "author")
 *  is added to it. Links to other sites also get `noreferrer`. Links between the
 *  owner's own sites do not, so the CMS visit counter can see that a visit came
 *  from the blog (only the origin is sent: Referrer-Policy strict-origin-when-
 *  cross-origin). Email links stay plain <a>: a new tab for mailto: would only
 *  open an empty page. */
export default function ExternalLink({ rel, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const rels = ['noopener', ...(isOwnSite(props.href) ? [] : ['noreferrer']), ...(rel ? rel.split(/\s+/) : [])]
  const unique = rels.filter((r, i) => r && rels.indexOf(r) === i)
  return <a {...props} target="_blank" rel={unique.join(' ')} />
}

#!/usr/bin/env node
/**
 * Tell IndexNow search engines (Bing, Yandex, Naver, Seznam and others) that
 * pages were added or changed. Google does not use IndexNow; for Google, use
 * "Request indexing" in Search Console.
 *
 *   npm run indexnow -- https://blog.dipakbist.com.np/blog/some-post
 *       Dry run: prints the request it would send. Nothing leaves your machine.
 *
 *   npm run indexnow -- --send https://blog.dipakbist.com.np/blog/some-post
 *       Sends it. Run this only after the page is live.
 *
 * The key below is public by design: search engines check that
 * https://blog.dipakbist.com.np/<key>.txt (public/<key>.txt) contains it.
 * Protocol: https://www.indexnow.org/documentation
 */
const KEY = 'e832e7f98f4a5a1290a9f9c8649f250a'
const HOST = 'blog.dipakbist.com.np'
const ENDPOINT = 'https://api.indexnow.org/indexnow'

const MEANING = {
  200: 'OK: the URLs were received.',
  202: 'Accepted: the URLs were received; the key is still being checked.',
  400: 'Bad request: the request format is invalid.',
  403: 'Forbidden: the key was not found or does not match the key file.',
  422: 'Unprocessable: a URL does not belong to the host, or the key does not match.',
  429: 'Too many requests: wait before sending again.',
}

async function main() {
  const args = process.argv.slice(2)
  const send = args.includes('--send')
  const urls = args.filter((a) => a !== '--send')

  if (urls.length === 0) {
    console.error('Give one or more full URLs, for example:\n  npm run indexnow -- https://blog.dipakbist.com.np/blog/my-post')
    process.exit(1)
  }

  const wrongHost = urls.filter((u) => {
    try {
      return new URL(u).host !== HOST
    } catch {
      return true
    }
  })
  if (wrongHost.length) {
    console.error(`These are not https://${HOST}/ URLs:\n  ${wrongHost.join('\n  ')}`)
    process.exit(1)
  }

  const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }

  if (!send) {
    console.log(`Dry run. This would be sent to ${ENDPOINT}:\n${JSON.stringify(body, null, 2)}`)
    console.log('\nAdd --send to send it (only after the pages are live).')
    return
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })
  console.log(`${response.status} ${MEANING[response.status] ?? response.statusText}`)
  if (!response.ok) process.exit(1)
}

main()

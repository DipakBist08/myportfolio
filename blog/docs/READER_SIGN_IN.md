# Claps, responses and Google sign-in

Every post has a Medium-style clap button, a responses (comments) section and
"Recommended from Dipak Bist QA Blog". Reading needs nothing. Clapping,
responding and replying need a Google sign-in.

| Piece | Where |
| --- | --- |
| Sign-in dialog (Google Identity Services, loaded only when it opens) | `components/blog/engagement/SignInDialog.tsx` |
| Who is signed in, one dialog per page | `components/blog/engagement/ReaderContext.tsx` |
| Clap totals, the reader's claps (max 50), undo; response count | `components/blog/engagement/PostEngagement.tsx` |
| Clap/response/share bars (top and bottom of the post) | `components/blog/engagement/EngagementBar.tsx` |
| Follow on LinkedIn (byline, side column, author box) | `components/blog/engagement/FollowOnLinkedIn.tsx` |
| Recommended from (topic match + claps/responses/readers) | `components/blog/engagement/RecommendedPosts.tsx`, `getRecommendationCandidates` in `lib/blog/utils.ts` |
| Responses | `components/blog/CommentSection.tsx` |
| API: sign-in, session cookie | `cms/backend/app/core/readers.py`, `app/api/public/readers.py` |
| API: claps, numbers for the cards | `cms/backend/app/api/public/engagement.py` |

## Turning it on (one-time)

Until both values below are set, the blog keeps the earlier name-and-email
response form and hides the clap button; nothing else changes. Once they are
set (and the blog redeployed), Google sign-in and claps switch on by themselves.

1. **Google Cloud Console** → APIs & Services → OAuth consent screen: user type
   External, app name "Dipak Bist QA Blog", a support email, scopes `openid`,
   `email`, `profile` only. Publish the app (In production), otherwise only test
   users can sign in.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
   - Authorized JavaScript origins: `https://blog.dipakbist.com.np` and, for
     local development, `http://localhost:3000` and `http://localhost`.
   - Authorized redirect URIs: none (the popup flow does not use them).
3. Copy the client ID (`….apps.googleusercontent.com`). It is not a secret: it
   is visible in the page. There is no client secret to store.
4. **Vercel**, project `dipak-blog` → Settings → Environment Variables:
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = the client ID. Redeploy (the value is built in).
5. **Render**, the API service → Environment: `GOOGLE_CLIENT_ID` = the same
   client ID. Redeploy.
6. Check: `https://api.dipakbist.com.np/health` shows `"reader_sign_in": "on"`.

Readers, claps and responses live in the API database. If Render has no
persistent `DATABASE_URL`, its SQLite file is wiped on every deploy and they go
with it.

## How it works

- Google's button returns a signed ID token to the page; the page posts it to
  `POST /api/public/auth/google`. The API checks the signature against Google's
  keys, the audience (our client ID), the issuer, the expiry and that the email
  is verified, then stores the reader (Google account ID, name, email, picture).
- The API sets one cookie, `reader_session`: httpOnly, Secure, SameSite=Lax,
  path `/api/public`, 30 days. It is signed with a key derived from
  `SECRET_KEY` and a separate audience, so it can never act as an admin token.
  `blog.` and `api.dipakbist.com.np` are the same site, so the cookie travels
  with the blog's requests (`credentials: 'include'`). Writes also check the
  `Origin` header. Vercel preview URLs are a different site, so sign-in does
  not work there.
- Claps: up to 50 per reader per post, sent in bursts (one request after the
  reader pauses); hold the button to keep clapping; Undo removes them.
- Responses use the Google name and picture; the email stays private. Comments
  from before sign-in was required still show under the name they were posted with.
- Recommended from: the build lists every other post by topic match (cluster 4,
  category 3, each shared tag 1, then newest). In the browser, once the section
  is near the screen, `GET /api/public/engagement?slugs=…` adds
  `log2(1 + claps + 3 × responses + readers / 10)` and the top four are shown.

## Local development

```sh
# API (cms/backend)
GOOGLE_CLIENT_ID=<client id> SECRET_KEY=<64 hex chars> DEBUG=true \
  .venv/bin/uvicorn app.main:app --reload --reload-dir app --port 8000
# Blog
NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client id> npm run dev
```

Open the blog at `http://localhost:3000` (an authorized origin). API tests:
`pytest` in `cms/backend` (`tests/test_readers.py` signs ID tokens with its own
key in place of Google's).

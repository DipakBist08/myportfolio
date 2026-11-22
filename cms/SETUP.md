# QA Portfolio CMS — Setup Guide

## Stack
| Layer | Tech |
|-------|------|
| Backend | FastAPI 0.111 · SQLAlchemy 2 · Alembic · SQLite |
| Frontend | React 18 · Vite 5 · TypeScript · Tailwind CSS 3 · shadcn/ui |
| Editor | TipTap 2 (headings, tables, code blocks, images, embeds, task lists…) |
| Auth | JWT access tokens (15 min) + Refresh tokens (7 days) + TOTP MFA |
| Charts | Recharts |

---

## Quick Start (local dev)

### 1 — Clone & configure

Create `cms/backend/.env` (git ignores it). Only `SECRET_KEY` is required;
everything else has a default in `backend/app/config.py`:

```bash
# cms/backend/.env
SECRET_KEY=            # python3 -c "import secrets; print(secrets.token_hex(32))"
DEBUG=true             # local only: turns on /docs and SQL logging
ADMIN_EMAIL=           # first admin, created by `python seed.py`
ADMIN_PASSWORD=
# Optional
# DATABASE_URL=sqlite:///./cms.db
# ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
# RESEND_API_KEY=      # without it, no emails are sent
# BACKEND_URL=http://localhost:8000
# BLOG_URL=https://blog.dipakbist.com.np
# GOOGLE_CLIENT_ID=    # reader Google sign-in on the blog
```

The admin app needs only the API address, and defaults to `http://localhost:8000`.
To point it elsewhere, create `cms/frontend/.env.local` with `VITE_API_URL=...`.

### 2 — Backend

```bash
cd cms/backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Seed database (admin user + sample data)
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```

Open API docs: http://localhost:8000/docs (only when `DEBUG=true` is set in `backend/.env`)

### 3 — Frontend

```bash
cd cms/frontend
npm install
npm run dev
```

Open CMS: http://localhost:5173

**Sign in** with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set in `backend/.env`
before running `python seed.py`. If they are not set, the seed script asks for them.
There are no default credentials.

---

## Docker (production)

```bash
cd cms

# Create backend/.env first (see Quick Start, step 1).
# Set VITE_API_URL for the admin app's build if the API is not on localhost:8000.

# Build & start
docker-compose up -d --build

# Run seed inside container
docker-compose exec backend python seed.py
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173

---

## Forgotten password

On the sign-in page, choose **Forgot password?** and enter the admin email. If it
belongs to an active account, the API emails a link to `CMS_URL/reset-password`
(through Resend, so `RESEND_API_KEY` must be set). The link works once, expires
after `PASSWORD_RESET_EXPIRE_MINUTES` (30), and stops working as soon as the
password changes. Setting a new password signs out every session; MFA stays on,
so the next sign-in still asks for the authenticator code.

- `CMS_URL` must be the admin site's address. It defaults to
  `https://cms.dipakbist.com.np`; set `CMS_URL=http://localhost:5173` in a local `.env`.
- Locally, with `DEBUG=true` and no `RESEND_API_KEY`, the link is written to the
  API log instead of being emailed.
- If email is not working, or the authenticator app is lost too, use
  `python reset_admin_password.py` (add `--clear-mfa`) from the backend host.

---

## Production database: Neon PostgreSQL

On Render's free plan there is no persistent disk, so `DATABASE_URL=sqlite:///./cms.db`
loses every account, comment, clap and subscriber on each deploy and restart (on
22/11/2026 this deleted the only admin). Production uses **Neon** (project
`nameless-scene-82381240`, default branch `production`, AWS us-east-1).

| Variable | Which Neon URL | Used for |
|---|---|---|
| `DATABASE_URL` | pooled (host ends in `-pooler`) | all API queries |
| `DATABASE_URL_UNPOOLED` | direct (no `-pooler`) | creating the tables at startup (`create_all`), as Neon advises for schema work |

1. **Render** → the API service → Environment: set both variables to the `production`
   branch's URLs (Neon console → Connect, or `neon connection-string production --pooled`
   and `neon connection-string production`). Render redeploys; the tables are created at startup.
2. Keep `ADMIN_EMAIL` and `ADMIN_PASSWORD` set there: if the database has no admin, the API
   creates one from them at startup (no sample data). Sign in, then turn MFA on again.

**Local work against Neon.** The repo root has `neon.ts` (the branch policy) and a
gitignored `.neon` link. `neon checkout dev --create` makes a development branch (it
expires after 7 days, per `neon.ts`), and `neon env pull` writes its `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` to the root `.env.local`. The API does not read that file by
itself (so a local run never touches production by accident): export the two variables
before starting it.

**Pull requests.** `.github/workflows/neon-pr-branches.yml` gives each pull request its own
Neon branch, `preview/pr-<number>-<branch>`, and deletes it when the PR closes (or after
14 days). It needs the repository variable `NEON_PROJECT_ID` and the secret `NEON_API_KEY`,
which Neon's GitHub integration set.

The test suite runs against PostgreSQL too: `TEST_DATABASE_URL=postgresql://… pytest`.
It drops and recreates every table, so use a throwaway branch, never `production`.

## MFA Setup

1. Log in → **Settings → Security → Enable MFA**
2. Scan the QR code with Google Authenticator / Authy
3. Enter the 6-digit code to confirm
4. Next login will require the OTP after your password

---

## Database Migrations

```bash
# Create migration after changing models
alembic revision --autogenerate -m "describe change"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

---

## Project Structure

```
cms/
├── backend/
│   ├── app/
│   │   ├── main.py              Entry point
│   │   ├── config.py            Settings (pydantic-settings)
│   │   ├── database.py          SQLAlchemy engine + session
│   │   ├── dependencies.py      FastAPI dependencies (auth)
│   │   ├── models/              SQLAlchemy ORM models
│   │   │   ├── user.py          User + RefreshToken
│   │   │   ├── post.py          Post (all fields + status enum)
│   │   │   ├── category.py      Category (nested)
│   │   │   ├── tag.py           Tag + M2M post_tags
│   │   │   ├── subscriber.py    Newsletter subscriber
│   │   │   ├── media.py         Uploaded file metadata
│   │   │   ├── settings.py      Key-value site settings
│   │   │   └── analytics.py     Analytics events
│   │   ├── schemas/             Pydantic v2 request/response models
│   │   ├── api/
│   │   │   ├── v1/              Admin API routes (JWT-protected)
│   │   │   │   ├── auth.py      Login, MFA, refresh, profile
│   │   │   │   ├── posts.py     CRUD + bulk status
│   │   │   │   ├── categories.py
│   │   │   │   ├── tags.py
│   │   │   │   ├── subscribers.py  + public subscribe/unsubscribe
│   │   │   │   ├── media.py     Upload + list + delete
│   │   │   │   ├── analytics.py Dashboard stats + event tracking
│   │   │   │   └── settings.py  Site settings CRUD
│   │   │   └── public/          Public read-only API (no auth)
│   │   │       ├── posts.py     List, single, recent, featured, related
│   │   │       ├── search.py    Full-text search
│   │   │       └── categories.py  + tags
│   │   └── core/
│   │       ├── security.py      JWT, TOTP, password hashing
│   │       ├── storage.py       Local file storage (swap for S3)
│   │       └── email.py         Email service (SMTP / disabled)
│   ├── alembic/                 Database migrations
│   ├── seed.py                  Sample data seeder
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              Routes + auth guard
│   │   ├── store/auth.ts        Zustand auth store (persisted)
│   │   ├── lib/api.ts           Axios + auto-refresh interceptor
│   │   ├── components/
│   │   │   ├── layout/          AdminLayout, Sidebar, Header
│   │   │   ├── editor/          BlogEditor (TipTap) + EditorToolbar
│   │   │   ├── ui/              Button, Input, Badge, AlertDialog, etc.
│   │   │   └── shared/          StatCard, StatusBadge, ConfirmDialog
│   │   └── pages/
│   │       ├── auth/            LoginPage, MFAVerifyPage
│   │       ├── DashboardPage    Stats + charts + recent posts
│   │       ├── posts/           PostsPage (table) + PostEditorPage
│   │       ├── CategoriesPage
│   │       ├── TagsPage
│   │       ├── SubscribersPage  + CSV export
│   │       ├── MediaPage        Grid/list + drag-drop upload
│   │       └── SettingsPage     Site config + profile + MFA + password
│   ├── tailwind.config.ts       Design tokens matching portfolio
│   └── Dockerfile
└── docker-compose.yml
```

---

## Public API Endpoints (for Portfolio Integration)

All are **GET**, no authentication required.

| Endpoint | Description |
|----------|-------------|
| `GET /api/public/posts?page=1&page_size=10` | Paginated published posts |
| `GET /api/public/posts/recent?limit=5` | Recent posts |
| `GET /api/public/posts/featured?limit=3` | Featured posts |
| `GET /api/public/posts/{slug}` | Single post by slug |
| `GET /api/public/posts/{slug}/related` | Related posts |
| `GET /api/public/search?q=playwright&page=1` | Full-text search |
| `GET /api/public/categories` | All categories with post counts |
| `GET /api/public/categories/tags` | All tags with post counts |
| `POST /api/v1/subscribers/subscribe` | Subscribe form handler |
| `GET /api/v1/subscribers/confirm?token=…` | Email confirmation |
| `GET /api/v1/subscribers/unsubscribe?token=…` | One-click unsubscribe |
| `POST /api/v1/analytics/event` | Track page view / share |

---

## Integrating with Your Static Portfolio

### Option A — Client-side fetch (simplest)

Add to your portfolio's JavaScript:

```javascript
const CMS_URL = 'http://localhost:8000'  // your deployed backend URL

async function loadRecentPosts() {
  const res = await fetch(`${CMS_URL}/api/public/posts/recent?limit=3`)
  const posts = await res.json()
  // Render posts...
}
```

### Option B — Build-time (Next.js / Astro)

```typescript
// In your blog's data fetching
const CMS_API = process.env.CMS_API_URL || 'http://localhost:8000'

export async function getPublishedPosts(page = 1) {
  const res = await fetch(`${CMS_API}/api/public/posts?page=${page}&page_size=10`)
  return res.json()
}
```

### Subscribe widget

```html
<form id="subscribe-form">
  <input type="email" id="sub-email" placeholder="your@email.com" />
  <button type="submit">Subscribe</button>
</form>
<script>
document.getElementById('subscribe-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('sub-email').value
  await fetch('http://localhost:8000/api/v1/subscribers/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  alert('Check your email to confirm!')
})
</script>
```

---

## Editor Features

The TipTap-powered editor supports:

| Feature | How |
|---------|-----|
| Headings H1–H4 | Toolbar buttons |
| Bold, Italic, Underline, Strike | Toolbar or Ctrl+B/I/U |
| Inline code | Toolbar or backtick shorthand |
| Code blocks with language | Click `</>` button → pick language |
| Tables | Insert 3×3, resize, add/remove rows/cols |
| Bullet / ordered / task lists | Toolbar |
| Blockquote | Toolbar |
| Links | Toolbar → enter URL |
| Images | Toolbar → enter image URL + alt text |
| YouTube embeds | Toolbar → enter YouTube URL |
| Text colour | Colour picker |
| Highlight | Toolbar |
| Text alignment | Left / center / right / justify |
| Horizontal rule | Toolbar |
| Autosave | Every 2s to localStorage |
| Preview mode | Toggle in editor top bar |
| Word / char count | Footer of editor |

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Key | Default | Description |
|-----|---------|-------------|
| `SECRET_KEY` | random | **Change in production** — used to sign JWTs |
| `DATABASE_URL` | sqlite:///./cms.db | SQLite locally. **Production: a PostgreSQL URL** (`postgresql://…` or `postgres://…`), because a SQLite file inside a free Render container is wiped on every deploy and restart |
| `DATABASE_URL_UNPOOLED` | empty | Neon's direct URL, used to create the tables at startup; empty means `DATABASE_URL` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 15 | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Refresh token lifetime |
| `DEBUG` | false | `true` locally for /docs and SQL logging; never in production |
| `ADMIN_EMAIL` | none | First admin's email: used by `seed.py`, and at every API start to recreate the admin if the database has none |
| `ADMIN_PASSWORD` | none | That admin's password, 12 to 72 bytes. Only used to create a missing admin; it never changes an existing account |
| `ALLOWED_ORIGINS` | localhost:5173 | Comma-separated CORS origins |
| `UPLOAD_DIR` | uploads | Directory for media files |
| `EMAILS_ENABLED` | false | Set to `true` + fill SMTP_ vars |
| `FRONTEND_URL` | http://localhost:5173 | Used in email links |

### Frontend (`frontend/.env`)

| Key | Default | Description |
|-----|---------|-------------|
| `VITE_API_URL` | http://localhost:8000 | Backend base URL |
| `VITE_APP_NAME` | QA Portfolio CMS | App title |
